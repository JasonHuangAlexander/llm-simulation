import { useState, useEffect } from "react";

export default function SetupPage({ setSetupConfirmed }) {
  const [scenario, setScenario] = useState(() => localStorage.getItem("scenario") || "");
  const [context, setContext] = useState(() => localStorage.getItem("context") || "");
  const [actionSpace, setActionSpace] = useState(() => localStorage.getItem("actionSpace") || "");
  const [confirmedScenario, setConfirmedScenario] = useState(false);

  const [demographicGroup, setDemographicGroup] = useState(() => localStorage.getItem("demographicGroup") || "");
  const [attributes, setAttributes] = useState(() => {
    const raw = localStorage.getItem("attributesList");
    return raw ? JSON.parse(raw) : [""];
  });
  const [confirmedAgent, setConfirmedAgent] = useState(false);

  const isScenarioReady = scenario.trim() !== "" && context.trim() !== "" && actionSpace.trim() !== "";
  const isAgentReady = demographicGroup.trim() !== "" && attributes.every((a) => a.trim() !== "");

  useEffect(() => {
    if (confirmedScenario && confirmedAgent) {
      setSetupConfirmed(true);
    } else {
      setSetupConfirmed(false);
    }
  }, [confirmedScenario, confirmedAgent, setSetupConfirmed]);

  const handleScenarioConfirm = () => {
    localStorage.setItem("scenario", scenario);
    localStorage.setItem("context", context);
    localStorage.setItem("actionSpace", actionSpace);
    setConfirmedScenario(true);
  };

  const handleAgentConfirm = () => {
    const filtered = attributes.map((a) => a.trim()).filter((a) => a);
    localStorage.setItem("demographicGroup", demographicGroup);
    localStorage.setItem("attributesList", JSON.stringify(filtered));
    setAttributes(filtered.length > 0 ? filtered : [""]);
    setConfirmedAgent(true);
  };

  return (
    <div className="page-1">
      <div className="column">
        <h2>Describe Scenario</h2>
        <label>
          Scenario:
          <textarea
            value={scenario}
            onChange={(e) => {
              const newValue = e.target.value;
              if (newValue !== scenario) {
                setScenario(newValue);
                setConfirmedScenario(false);
              }
            }}
            rows={17}
            placeholder="e.g., It’s a normal day, and you are at home. You are in the middle of a task you need to finish soon. Suddenly, you receive
the following message on your phone from the local Office of Emergency Services:
“The National Weather Service is predicting flooding in your neighborhood within the next 24 hours. Police are advising
residents who live in this area to be prepared for potential evacuation at any time. Info on how to prepare to evacuate
can be found on our website. Updates to follow.”
Additional Information: Evacuating now will require pausing your task and may take time. However, staying may carry
safety risks if the flood comes unexpectedly."
          />
        </label>
        <label>
          Context:
          <textarea
            value={context}
            onChange={(e) => {
              const newValue = e.target.value;
              if (newValue !== context) {
                setContext(newValue);
                setConfirmedScenario(false);
              }
            }}
            rows={4}
            placeholder="e.g., how likely would it be for this person to evacuate during an emergency, and in what circumstances would this person evacuate"
          />
        </label>
        <label>
          Action Space (comma-separated):
          <input
            type="text"
            value={actionSpace}
            onChange={(e) => {
              const newValue = e.target.value;
              if (newValue !== actionSpace) {
                setActionSpace(newValue);
                setConfirmedScenario(false);
              }
            }}
            placeholder="e.g., Evacuate, Stay"
          />
        </label>
        <button
          onClick={handleScenarioConfirm}
          disabled={!isScenarioReady}
          style={{
            backgroundColor: confirmedScenario ? "#ccc" : isScenarioReady ? "#b9eb98" : "#ccc",
            color: "black",
            cursor: isScenarioReady ? "pointer" : "not-allowed",
          }}
        >
          {confirmedScenario ? "Scenario Confirmed!" : "Confirm Scenario"}
        </button>
      </div>

      <div className="column">
        <h2>Customize Agents</h2>
        <label>
          Demographic Group:
          <input
            type="text"
            value={demographicGroup}
            onChange={(e) => {
              const newValue = e.target.value;
              if (newValue !== demographicGroup) {
                setDemographicGroup(newValue);
                setConfirmedAgent(false);
              }
            }}
            placeholder="e.g., Gender"
          />
        </label>
        <label>Demographic Attributes:</label>
        {attributes.map((attr, idx) => (
          <div key={idx} style={{ display: "flex", marginBottom: "8px" }}>
            <input
              type="text"
              value={attr}
              onChange={(e) => {
                const newValue = e.target.value;
                if (newValue !== attr) {
                  const newAttrs = [...attributes];
                  newAttrs[idx] = newValue;
                  setAttributes(newAttrs);
                  setConfirmedAgent(false);
                }
              }}
              placeholder="e.g., Male"
              style={{ flex: 1, marginRight: "8px" }}
            />
            {attributes.length > 1 && (
              <small-button
                  onClick={() => {
                    setAttributes(attributes.filter((_, i) => i !== idx));
                    setConfirmedAgent(false);
                  }}
                  style={{
                    backgroundColor:"#EFEFEF",
                    color: "black",
                    borderRadius: "5%",
                    padding: "0 10px",
                    cursor: "pointer"
                  }}
                >
                  −
              </small-button>
            )}
          </div>
        ))}
        <button
          onClick={() => setAttributes([...attributes, ""])}
          style={{ marginBottom: "12px" }}
        >
          + Add Attribute
        </button>
        <button
          onClick={handleAgentConfirm}
          disabled={!isAgentReady}
          style={{
            backgroundColor: confirmedAgent ? "#ccc" : isAgentReady ? "#b9eb98" : "#ccc",
            color: "black",
            cursor: isAgentReady ? "pointer" : "not-allowed",
          }}
        >
          {confirmedAgent ? "Agent Confirmed!" : "Confirm Agent"}
        </button>
      </div>
    </div>
  );
}
