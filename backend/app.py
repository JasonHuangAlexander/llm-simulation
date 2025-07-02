import uuid
from flask import Flask, request, jsonify, abort
from flask_cors import CORS
from openai import AsyncOpenAI
import asyncio
import aiofiles
import os
import json
from datetime import datetime
from dotenv import load_dotenv
import traceback
import threading

# Load environment variables
load_dotenv()
client = AsyncOpenAI()  # Async client
print("loaded API key")

app = Flask(__name__)
CORS(app)

# Dictionary to store progress for each simulation ID
simulation_progress = {}

# Prompt templates
PERSONA_USER_PROMPT_TEMPLATE = (
    "You are skilled at creating names and personas that represent different people authentically. "
    "Your task is to craft a detailed persona for someone with the following demographic: {attribute}. Include specific "
    "and relevant details about this person's background, personality, and preferences. "
    "Additionally, describe in the persona {context}. "
    "Please follow this json format in your response:\n"
    "{{\n"
    "  \"name\": \"<a string representing the person's name>\",\n"
    "  \"description\": \"<a detailed string describing the person's persona>\"\n"
    "}}"
)

DECISION_USER_PROMPT_TEMPLATE = (
    "You are {name}. You have the following persona: {description}\n"
    "You are facing the following situation: {scenario}\n"
    "Respond in the following json format:\n"
    "{{\n"
    "  \"decision\": \"<a string, {actionSpace}>\",\n"
    "  \"rationale\": \"<a string, representing the rationale behind your decision>\"\n"
    "}}"
)

def strip_code_fences(text):
    # Remove common code fence markers like ```json or ```
    lines = text.strip().splitlines()
    if lines and lines[0].strip().startswith("```"):
        lines = lines[1:]  # drop opening fence
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]  # drop closing fence
    return "\n".join(lines).strip()


print("prompt templates initialized")

@app.route('/generate_persona', methods=['POST'])
def generate_persona_and_decision():
    print("generate_persona called")
    data = request.json or {}
    print("Payload received:", json.dumps(data, indent=2))

    scenario = data.get('scenario', '')
    context = data.get('context', '')
    demographicGroup = data.get('demographicGroup', '')
    attributesList = data.get('attributesList', [])
    actionSpace = data.get('actionSpace', '')

    sim_id = str(uuid.uuid4())
    total_tasks = len(attributesList) * 50
    simulation_progress[sim_id] = {'completed': 0, 'total': total_tasks, 'status': 'running'}

    thread = threading.Thread(target=lambda: asyncio.run(handle_generation(sim_id, attributesList, context, scenario, demographicGroup, actionSpace)))
    thread.start()

    return jsonify({"simulationId": sim_id, "message": "Simulation started"}), 202

async def handle_generation(sim_id, attributesList, context, scenario, demographicGroup, actionSpace):
    tasks = []
    for attribute in attributesList:
        for i in range(50):
            tasks.append(
                generate_one(sim_id, attribute, context, scenario, demographicGroup, actionSpace, i + 1)
            )

    responses = await asyncio.gather(*tasks, return_exceptions=True)
    all_agents = [resp for resp in responses if isinstance(resp, dict)]

    if sim_id in simulation_progress:
        simulation_progress[sim_id]['completed'] = simulation_progress[sim_id]['total']
        simulation_progress[sim_id]['status'] = 'completed'
        simulation_progress[sim_id]['results'] = all_agents

    return all_agents

async def generate_one(sim_id, attribute, context, scenario, demographicGroup, actionSpace, index, max_retries=10):
    action_options = [a.strip().lower() for a in actionSpace.split(",")] if isinstance(actionSpace, str) else []
    
    async def generate_persona_with_retries():
        for attempt in range(max_retries):
            persona_prompt = PERSONA_USER_PROMPT_TEMPLATE.format(
                attribute=attribute,
                context=context,
                demographicGroup=demographicGroup
            )
            resp = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "user", "content": persona_prompt}
                ],
                temperature=0.7
            )
            text = strip_code_fences(resp.choices[0].message.content.strip())
            try:
                parsed = json.loads(text)
                if "name" in parsed and "description" in parsed:
                    return parsed
                else:
                    print(f"Persona JSON missing keys on attempt {attempt+1}: {text}")
            except json.JSONDecodeError:
                print(f"Persona JSON parse failed on attempt {attempt+1}: {text}")
        raise Exception("Failed to generate valid persona JSON after retries")

    #this reformats the action space to exactly match the paper
    actionSpaceReformatted = ' or '.join([f'"{item.strip()}"' for item in actionSpace.split(',') if item.strip()])
    
    async def generate_decision_with_retries(name, description):
        for attempt in range(max_retries):
            decision_prompt = DECISION_USER_PROMPT_TEMPLATE.format(
                scenario=scenario,
                context=context,
                name=name,
                description=description,
                demographicGroup=demographicGroup,
                attribute=attribute,
                actionSpace=actionSpaceReformatted
            )
            print(decision_prompt)
            resp = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "user", "content": decision_prompt}
                ],
                temperature=0.2
            )
            decision_text = resp.choices[0].message.content.strip()
            print(f"Decision attempt {attempt+1} text:\n{decision_text}")

            try:
                parsed = json.loads(decision_text)
                decision = parsed.get("decision", "").strip()
                rationale = parsed.get("rationale", "").strip()
                if not decision:
                    print(f"Decision JSON missing 'decision' key on attempt {attempt+1}")
                    continue
                
                if decision.lower() in action_options:
                    return parsed
                else:
                    print(f"Action '{decision}' not in actionSpace on attempt {attempt+1}: {action_options}")
            except json.JSONDecodeError:
                print(f"Decision JSON parse failed on attempt {attempt+1}: {decision_text}")
        raise Exception("Failed to generate valid decision JSON with valid decision after retries")

    try:
        parsed_persona = await generate_persona_with_retries()
        name = parsed_persona["name"]
        description = parsed_persona["description"]

        parsed_decision = await generate_decision_with_retries(name, description)
        decision = parsed_decision["decision"]
        rationale = parsed_decision["rationale"]

        persona = {"name": name, "description": description}
        result = {"decision": decision, "rationale": rationale}

        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "scenario": scenario,
            "context": context,
            "demographicGroup": demographicGroup,
            "attribute": attribute,
            "actionSpace": actionSpace,
            "persona": persona,
            "result": result,
            "raw_response": json.dumps(parsed_decision)
        }
        async with aiofiles.open("simulation_log.jsonl", "a") as f:
            await f.write(json.dumps(log_entry) + "\n")
            print(f"Wrote log for '{attribute}' #{index}")

        if sim_id in simulation_progress:
            simulation_progress[sim_id]['completed'] += 1
            print(f"Progress for {sim_id}: {simulation_progress[sim_id]['completed']}/{simulation_progress[sim_id]['total']}")


        return {
            "attribute": attribute,
            "persona": persona,
            "result": result
        }

    except Exception as e:
        print(f"Exception in generate_one for '{attribute}' #{index}: {e}")
        print(traceback.format_exc())
        return None

@app.route('/simulation_progress/<sim_id>', methods=['GET'])
def get_simulation_progress(sim_id):
    progress_info = simulation_progress.get(sim_id, {'completed': 0, 'total': 0, 'status': 'not_found'})
    return jsonify(progress_info)

@app.route('/simulation_results/<sim_id>', methods=['GET'])
def get_simulation_results(sim_id):
    progress_info = simulation_progress.get(sim_id)
    if progress_info and progress_info['status'] == 'completed' and 'results' in progress_info:
        return jsonify({"agents": progress_info['results']})
    elif progress_info and progress_info['status'] == 'running':
        return jsonify({"message": "Simulation still running"}), 202
    return jsonify({"message": "Simulation results not found or not completed"}), 404

@app.route("/update_persona", methods=["PATCH"])
def update_persona():
    data = request.json or {}
    print("update_persona called with:", json.dumps(data, indent=2))

    required_keys = {"id", "name", "description"}
    if not required_keys.issubset(data.keys()):
        abort(400, f"Missing required fields: {required_keys - data.keys()}")

    update_entry = {
        "id": data["id"],
        "updated_name": data["name"],
        "updated_description": data["description"],
        "timestamp": datetime.now().isoformat()
    }

    asyncio.run(log_update_entry(update_entry))

    return jsonify({"status": "success", "updated": update_entry})

async def log_update_entry(entry):
    async with aiofiles.open("updated_personas.jsonl", "a") as f:
        await f.write(json.dumps(entry) + "\n")
        print(f"✔ Logged update for persona {entry['id']}")


if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5000)