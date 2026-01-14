import { useState, useMemo } from "react";
import "./index.css";

// Backend origin — match OldApp which used the Render host. Adjust if your backend is hosted elsewhere.
const BACKEND_ORIGIN = 'https://llm-simulation.onrender.com';

const navStyle = {
  width: 220,
  minHeight: '100vh',
  borderRight: '1px solid #d9d9d9',
  padding: '24px 16px',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const experimentStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const circle = (active) => ({
  width: 12,
  height: 12,
  borderRadius: 12,
  border: '2px solid #333',
  background: active ? '#333' : '#fff',
});

export default function App() {
  const [view, setView] = useState('welcome');

  // Available demographic groups and their attributes
  const [demographics, setDemographics] = useState({
    Personas: ['Persona 1', 'Persona 2'],
    Race: ['White', 'Black', 'Asian', 'Latinx'],
    'Sexual Orientation': ['Straight'],
    Gender: ['Male', 'Female']
  });

  // Selection state: active persona and per-persona selections
  const [selectedPersona, setSelectedPersona] = useState('Persona 2');
  const [perPersonaSelections, setPerPersonaSelections] = useState(() => {
    const out = {};
    (({ Personas: ['Persona 1', 'Persona 2'] }).Personas || demographics.Personas || []).forEach((p) => {
      out[p] = {
        Personas: [p],
        Race: p === 'Persona 2' ? ['Black'] : [],
        'Sexual Orientation': p === 'Persona 2' ? ['Straight'] : [],
        Gender: p === 'Persona 2' ? ['Female'] : []
      };
    });
    // If demographics.Personas exists, ensure those are initialized too
    (demographics.Personas || []).forEach((p) => {
      if (!out[p]) out[p] = { Personas: [p], Race: [], 'Sexual Orientation': [], Gender: [] };
    });
    return out;
  });

  // Inline edit state for newly added pills
  const [editingPill, setEditingPill] = useState(null); // { group, attr }
  const [editValue, setEditValue] = useState('');
  // Inline edit for category (group) names
  const [editingGroup, setEditingGroup] = useState(null); // group name placeholder when editing
  const [editGroupValue, setEditGroupValue] = useState('');
  // Hover/focus helpers to show delete affordances
  const [hoveredPill, setHoveredPill] = useState(null); // { group, attr }
  const [hoveredCategory, setHoveredCategory] = useState(null); // group
  // Step text state for editable boxes
  const [scenarioText, setScenarioText] = useState('');
  const [contextText, setContextText] = useState('');
  const [actionsText, setActionsText] = useState('');

  // Generation state for quick persona generation
  const [generating, setGenerating] = useState(false);
  const [generatedPersonas, setGeneratedPersonas] = useState([]);
  const [generatingActions, setGeneratingActions] = useState(false);
  const [generatedActions, setGeneratedActions] = useState([]);
  const [simulationSignificance, setSimulationSignificance] = useState(null);
  const [simulationSummary, setSimulationSummary] = useState(null);
  // Loading/progress state (two-stage)
  const [loadingStage, setLoadingStage] = useState(null); // 'personas' | 'decisions' | null
  const [personaProgress, setPersonaProgress] = useState({ completed: 0, total: 0 });
  const [decisionProgress, setDecisionProgress] = useState({ completed: 0, total: 0 });

  // Compute whether Run is ready: all textboxes non-empty, at least 2 personas, at least 2 actions,
  // and every persona has a selection for each populated group
  const isRunReady = useMemo(() => {
    if (!scenarioText.trim() || !contextText.trim() || !actionsText.trim()) return false;
    const personas = demographics.Personas || [];
    // require at least 2 personas
    if (personas.length < 2) return false;
    // require at least 2 distinct actions (comma-separated)
    const actionsList = (actionsText || '').split(',').map(a => a.trim()).filter(Boolean);
    if (actionsList.length < 2) return false;
    const groups = Object.keys(demographics).filter(g => g !== 'Personas' && (demographics[g] || []).length > 0);
    for (const group of groups) {
      for (const p of personas) {
        const sel = perPersonaSelections[p] && perPersonaSelections[p][group];
        if (!sel || sel.length === 0) return false;
      }
    }
    // Ensure each persona has a unique combination of selections
    const seen = new Set();
    for (const p of personas) {
      const keyParts = groups.map(g => (perPersonaSelections[p] && perPersonaSelections[p][g] && perPersonaSelections[p][g][0]) || '').map(x => x.replace(/\s+/g, ' ').trim());
      const key = keyParts.join('||');
      if (seen.has(key)) return false;
      seen.add(key);
    }
    return true;
  }, [scenarioText, contextText, actionsText, demographics, perPersonaSelections]);

  const isResultsReady = useMemo(() => {
    return !!(generatedActions && generatedActions.length > 0);
  }, [generatedActions]);

  const availableActions = useMemo(() => (actionsText || '').split(',').map(a => a.trim()).filter(Boolean), [actionsText]);

  // Color-blind friendly palette (mapped by persona index)
  const COLOR_PALETTE = ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#56B4E9', '#E69F00'];

  const getPersonaColor = (personaName) => {
    const list = demographics.Personas || [];
    const idx = list.indexOf(personaName);
    if (idx === -1) return COLOR_PALETTE[0];
    return COLOR_PALETTE[idx % COLOR_PALETTE.length];
  };

  const addAttribute = (group) => {
    const placeholder = `enter new ${group}`;
    setDemographics(prev => {
      if ((prev[group] || []).includes(placeholder)) return prev;
      return { ...prev, [group]: [...(prev[group] || []), placeholder] };
    });
    // Start inline editing for the placeholder; do NOT select it by default
    setEditingPill({ group, attr: placeholder });
    setEditValue('');
  };

  const addCategory = () => {
    // create a unique placeholder name
    let base = 'enter new category';
    let placeholder = base;
    let i = 1;
    while ((demographics[placeholder])) {
      placeholder = `${base} ${i}`;
      i += 1;
    }
    setDemographics(prev => ({ ...prev, [placeholder]: [] }));
    setEditingGroup(placeholder);
    setEditGroupValue('');
  };

  const commitCategory = (oldName, newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed) {
      // if empty and this was a newly-created placeholder, remove it
      if (oldName && oldName.startsWith('enter new')) {
        setDemographics(prev => {
          const copy = { ...prev };
          delete copy[oldName];
          return copy;
        });
      }
      setEditingGroup(null);
      setEditGroupValue('');
      return;
    }
    // Prevent duplicate group names
    if (trimmed in demographics && trimmed !== oldName) {
      // If this was a newly created placeholder group, remove it
      if (oldName && oldName.startsWith('enter new')) {
        setDemographics(prev => {
          const copy = { ...prev };
          delete copy[oldName];
          return copy;
        });
      }
      // do nothing otherwise
      setEditingGroup(null);
      setEditGroupValue('');
      return;
    }
    setDemographics(prev => {
      const copy = { ...prev };
      const attrs = copy[oldName] || [];
      delete copy[oldName];
      copy[trimmed] = attrs;
      return copy;
    });
    // Update perPersonaSelections: move values for this group
    setPerPersonaSelections(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(persona => {
        const groupVals = copy[persona][oldName];
        if (groupVals !== undefined) {
          copy[persona] = { ...copy[persona] };
          copy[persona][trimmed] = groupVals;
          delete copy[persona][oldName];
        } else {
          // ensure the new group exists
          copy[persona] = { ...copy[persona], [trimmed]: copy[persona][trimmed] || [] };
        }
      });
      return copy;
    });
    setEditingGroup(null);
    setEditGroupValue('');
  };

  const cancelCategory = () => {
    if (editingGroup) {
      const old = editingGroup;
      setDemographics(prev => {
        const copy = { ...prev };
        delete copy[old];
        return copy;
      });
    }
    setEditingGroup(null);
    setEditGroupValue('');
  };

  const commitEdit = (group, oldAttr, newText) => {
    const trimmed = (newText || '').trim();
    // If user entered nothing, remove placeholder if it was newly-created
    if (!trimmed) {
      if ((oldAttr || '').startsWith('enter new')) {
        setDemographics(prev => {
          const list = prev[group] || [];
          return { ...prev, [group]: list.filter(x => x !== oldAttr) };
        });
      }
      setEditingPill(null);
      setEditValue('');
      return;
    }
    // Prevent duplicate within same group (allow same name in different groups)
    const existingInGroup = (demographics[group] || []).some(x => x === trimmed);
    if (existingInGroup && trimmed !== oldAttr) {
      // If this was a newly created placeholder pill, remove it entirely
      if ((oldAttr || '').startsWith('enter new')) {
        setDemographics(prev => {
          const list = prev[group] || [];
          return { ...prev, [group]: list.filter(x => x !== oldAttr) };
        });
      }
      // do nothing on duplicate
      setEditingPill(null);
      setEditValue('');
      return;
    }
    setDemographics(prev => {
      const list = prev[group] || [];
      return { ...prev, [group]: list.map(x => x === oldAttr ? trimmed : x) };
    });
    // Update per-persona selections if needed
    setPerPersonaSelections(prev => {
      const copy = { ...prev };
      // If editing a persona name, rename the key
      if (group === 'Personas') {
        if (oldAttr in copy) {
          copy[trimmed] = copy[oldAttr];
          delete copy[oldAttr];
          // If the edited persona was currently selected, keep it selected
          if (selectedPersona === oldAttr) {
            setSelectedPersona(trimmed);
          }
        } else {
          // New persona created: initialize empty selections
          copy[trimmed] = { Personas: [trimmed], Race: [], 'Sexual Orientation': [], Gender: [] };
        }
      } else {
        // Replace attribute label within any persona selection arrays
        Object.keys(copy).forEach(persona => {
          const groupList = copy[persona][group] || [];
          if (groupList.includes(oldAttr)) {
            copy[persona] = { ...copy[persona], [group]: groupList.map(x => x === oldAttr ? trimmed : x) };
          }
        });
      }
      return copy;
    });
    setEditingPill(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    // If the editing pill was a placeholder, remove it
    if (editingPill) {
      const { group, attr } = editingPill;
      if ((attr || '').startsWith('enter new')) {
        setDemographics(prev => {
          const list = prev[group] || [];
          return { ...prev, [group]: list.filter(x => x !== attr) };
        });
      }
    }
    setEditingPill(null);
    setEditValue('');
  };

  // Delete an attribute (pill) from a group
  const deleteAttribute = (group, attr) => {
    if (group === 'Personas') {
      // Remove persona from list and from per-persona selections
      setDemographics(prev => {
        const list = prev.Personas || [];
        return { ...prev, Personas: list.filter(x => x !== attr) };
      });
      setPerPersonaSelections(prev => {
        const copy = { ...prev };
        delete copy[attr];
        return copy;
      });
      // If the deleted persona was selected, pick another or clear
      setSelectedPersona(prev => {
        if (prev === attr) {
          const remaining = (demographics.Personas || []).filter(x => x !== attr);
          return remaining[0] || null;
        }
        return prev;
      });
      return;
    }

    // Remove attribute from demographics
    setDemographics(prev => {
      const list = prev[group] || [];
      return { ...prev, [group]: list.filter(x => x !== attr) };
    });

    // Remove attribute from any persona selections
    setPerPersonaSelections(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(persona => {
        if (copy[persona] && copy[persona][group]) {
          copy[persona] = { ...copy[persona], [group]: copy[persona][group].filter(x => x !== attr) };
        }
      });
      return copy;
    });
  };

  // Delete an entire demographic category (group)
  const deleteCategory = (group) => {
    // Remove from demographics
    setDemographics(prev => {
      const copy = { ...prev };
      delete copy[group];
      return copy;
    });
    // Remove from per-persona selections
    setPerPersonaSelections(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(persona => {
        if (copy[persona] && copy[persona][group] !== undefined) {
          copy[persona] = { ...copy[persona] };
          delete copy[persona][group];
        }
      });
      return copy;
    });
  };

  const toggleSelection = (group, attr) => {
    if (group === 'Personas') {
      // selecting a persona switches active persona
      setSelectedPersona(attr);
      // ensure perPersonaSelections has an entry for this persona
      setPerPersonaSelections(prev => {
        if (prev && prev[attr]) return prev;
        return { ...prev, [attr]: { Personas: [attr], Race: [], 'Sexual Orientation': [], Gender: [] } };
      });
      return;
    }

    // For other groups, store selection under the active persona
    setPerPersonaSelections((prev) => {
      const copy = { ...prev };
      const persona = selectedPersona;
      if (!persona) return prev;
      const current = (copy[persona] && (copy[persona][group] || []));
      const currentlySelected = current.includes(attr);
      copy[persona] = { ...copy[persona], [group]: currentlySelected ? [] : [attr] };
      return copy;
    });
  };

  const runSimulation = async () => {
    // Generate personas many times and compute distributions in parallel
    const personas = demographics.Personas || [];
    if (!personas.length) return;

    const actionsList = (actionsText || '').split(',').map(a => a.trim()).filter(Boolean);
    if (!actionsList.length) return;

    setGenerating(true);
    setSimulationSignificance(null);
    setSimulationSummary(null);
    setGeneratedActions([]);
    setGeneratedPersonas([]);
    setView('run');

    try {
      // Prepare aggregation structures
      const countsByPersona = {};
      const lastPersonaObj = {};
      personas.forEach(p => { countsByPersona[p] = Object.fromEntries(actionsList.map(a => [a, 0])); lastPersonaObj[p] = { name: p, description: '' }; });

      const totalTasks = personas.length * 50;
      // Both persona generation and decision generation will happen per-task; show totals accordingly
      setLoadingStage('personas');
      setPersonaProgress({ completed: 0, total: totalTasks });
      setDecisionProgress({ completed: 0, total: totalTasks });

      // Build tasks: for each persona, create 50 tasks
      const tasks = [];
      for (const p of personas) {
        for (let i = 0; i < 50; i++) tasks.push({ personaKey: p });
      }

      // Run all tasks in parallel (each task: generate persona, then generate one decision)
      await Promise.allSettled(tasks.map(async (t) => {
        const p = t.personaKey;
        // generate persona
        let personaObj = { name: p, description: '' };
        try {
          const pres = await fetch(`${BACKEND_ORIGIN}/generate_persona_quick`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attribute: p, demographicGroup: 'Personas', context: contextText, scenario: scenarioText, actionSpace: actionsText, persona: p })
          });
          if (pres.ok) personaObj = await pres.json();
        } catch (e) {
          console.warn('persona quick failed for', p, e);
        } finally {
          // update persona progress per generated persona instance
          setPersonaProgress(prev => ({ ...prev, completed: (prev.completed || 0) + 1 }));
        }
        // keep last persona obj for display
        lastPersonaObj[p] = personaObj;

        // mark that decisions stage is in-flight
        setLoadingStage('decisions');

        // generate one decision for this persona-instance
        try {
          const dres = await fetch(`${BACKEND_ORIGIN}/generate_decision_quick`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: personaObj.name, description: personaObj.description, scenario: scenarioText, context: contextText, actionSpace: actionsText, demographicGroup: 'Personas', attribute: p })
          });
          if (dres && dres.ok) {
            const ddata = await dres.json();
            const decision = (ddata.decision || '').trim();
            const matched = actionsList.find(act => act.toLowerCase() === decision.toLowerCase()) || null;
            if (matched) {
              countsByPersona[p][matched] = (countsByPersona[p][matched] || 0) + 1;
            }
          }
        } catch (e) {
          console.warn('decision quick error', e);
        } finally {
          // update decision progress per generated decision
          setDecisionProgress(prev => ({ ...prev, completed: (prev.completed || 0) + 1 }));
        }
      }));

      // finished loading
      setLoadingStage(null);

      // build summary from countsByPersona
      const summary = personas.map(p => {
        const counts = countsByPersona[p] || {};
        const total = Object.values(counts).reduce((s, v) => s + v, 0);
        return { persona: p, personaObj: lastPersonaObj[p], counts, total, percentages: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, total ? (v / total) : 0])) };
      });

      // compute significance: pick action with max variance across personas, test most-different pair with two-proportion z-test
      const actionVars = Object.keys(actionsList).length ? actionsList : Object.keys(summary[0].counts || {});
      // find action with max range
      let chosenAction = null;
      let maxRange = 0;
      for (const action of actionsList) {
        const props = summary.map(s => (s.total ? (s.counts[action] / s.total) : 0));
        const range = Math.max(...props) - Math.min(...props);
        if (range > maxRange) { maxRange = range; chosenAction = action; }
      }

      const twoPropZTest = (countA, nA, countB, nB) => {
        if (nA === 0 || nB === 0) return 1.0;
        const pA = countA / nA;
        const pB = countB / nB;
        const pPool = (countA + countB) / (nA + nB);
        const se = Math.sqrt(pPool * (1 - pPool) * (1 / nA + 1 / nB));
        if (se === 0) return 1.0;
        const z = (pA - pB) / se;
        // normal cdf via erf
        const phi = (x) => 0.5 * (1 + Math.erf ? Math.erf(x / Math.sqrt(2)) : (function(x){ // fallback approx
          // Abramowitz and Stegun approximation
          const t = 1 / (1 + 0.2316419 * Math.abs(x));
          const d = 0.3989423 * Math.exp(-x * x / 2);
          let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
          if (x > 0) prob = 1 - prob;
          return prob;
        })(x));
        const pval = 2 * (1 - phi(Math.abs(z)));
        return pval;
      };

      let significance = null;
      if (!chosenAction) {
        // No variable action found — set default non-significant result so UI shows a message
        significance = { attributeA: null, attributeB: null, action: null, countA: 0, totalA: 0, countB: 0, totalB: 0, p_value: 1.0, significant: false, note: 'No varying action across personas' };
      } else {
        // find personas with min and max proportion for chosenAction
        let minP = 1, maxP = 0; let minIdx = 0, maxIdx = 0;
        summary.forEach((s, idx) => {
          const prop = s.total ? (s.counts[chosenAction] / s.total) : 0;
          if (prop < minP) { minP = prop; minIdx = idx; }
          if (prop > maxP) { maxP = prop; maxIdx = idx; }
        });
        const A = summary[minIdx];
        const B = summary[maxIdx];
        const countA = A.counts[chosenAction] || 0;
        const countB = B.counts[chosenAction] || 0;
        const nA = A.total || 0;
        const nB = B.total || 0;
        const p_value = twoPropZTest(countA, nA, countB, nB);
        significance = { attributeA: A.persona, attributeB: B.persona, action: chosenAction, countA, totalA: nA, countB, totalB: nB, p_value, significant: p_value < 0.05 };
      }

      setSimulationSummary(summary);
      setSimulationSignificance(significance);
      setGenerating(false);
      setView('results');
    } catch (err) {
      console.error('Run simulation failed', err);
      setGenerating(false);
    }
  };

  const renderMain = () => {
    switch (view) {
      case 'experiment':
        return (
          <div style={{padding: 24}}>
            <h2 style={{marginTop: 8, marginBottom: 16}}>Setup</h2>
            <div style={{display: 'flex', gap: 24}}>
              {/* Left column: numbered boxes */}
              <div style={{flex: '0 0 46%', display: 'flex', flexDirection: 'column', gap: 18}}>
                <div style={{position: 'relative', border: '1px solid #cfcfcf', padding: 12, height: 260, boxSizing: 'border-box'}}>
                  <div style={{position: 'absolute', left: -12, top: -12, width: 28, height: 28, borderRadius: 14, background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12}}>1</div>
                  <div style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
                    <div style={{fontWeight: 600, marginBottom: 8}}>Scenario</div>
                    <textarea
                      value={scenarioText}
                      placeholder="Enter what situation the personas are in"
                      onChange={(e) => setScenarioText(e.target.value)}
                      style={{flex: 1, resize: 'vertical', padding: 12, borderRadius: 8, border: '1px solid #ddd', fontSize: 14}}
                    />
                  </div>
                </div>

                <div style={{position: 'relative'}}>
                  <div style={{position: 'absolute', left: -12, top: -12, width: 28, height: 28, borderRadius: 14, background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12}}>2</div>
                  <div style={{border: '1px solid #cfcfcf', padding: 12}}>
                    <div style={{fontSize: 14, fontWeight: 500, marginBottom: 8}}>Context</div>
                    <textarea
                      value={contextText}
                      placeholder="Enter a guiding question to help direct the personas' thought process"
                      onChange={(e) => setContextText(e.target.value)}
                      style={{width: '100%', minHeight: 80, resize: 'vertical', padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 14}}
                    />
                  </div>
                </div>

                <div style={{position: 'relative', border: '1px solid #cfcfcf', padding: 12, height: 160, boxSizing: 'border-box'}}>
                  <div style={{position: 'absolute', left: -12, top: -12, width: 28, height: 28, borderRadius: 14, background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12}}>3</div>
                  <div style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
                    <div style={{fontWeight: 600, marginBottom: 8}}>Actions</div>
                    <textarea
                      value={actionsText}
                      placeholder="Enter what actions the personas can take (comma-separated)"
                      onChange={(e) => setActionsText(e.target.value)}
                      style={{flex: 1, resize: 'vertical', padding: 12, borderRadius: 8, border: '1px solid #ddd', fontSize: 14}}
                    />
                  </div>
                </div>
              </div>

              {/* Right column: persona demographics box */}
              <div style={{flex: 1, border: '1px solid #cfcfcf', padding: 18, position: 'relative'}}>
                <div style={{position: 'absolute', left: -12, top: -12, width: 28, height: 28, borderRadius: 14, background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12}}>4</div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                  <div style={{fontSize: 18, fontWeight: 600}}>Persona Demographics</div>
                  <div style={{fontSize: 12, color: '#888'}}> </div>
                </div>

                <div style={{display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18}}>
                  {(demographics.Personas || []).map((p) => {
                    const personaColor = getPersonaColor(p);
                    const isSelected = selectedPersona === p;
                    return (editingPill && editingPill.group === 'Personas' && editingPill.attr === p) ? (
                      <input
                        key={p}
                        autoFocus
                        value={editValue}
                        placeholder={p}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit('Personas', p, editValue)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit('Personas', p, editValue);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        style={{padding: '8px 12px', borderRadius: 6, border: '1px solid #bbb'}}
                      />
                    ) : (
                      <div
                        key={p}
                        tabIndex={0}
                        onClick={() => toggleSelection('Personas', p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Delete' || e.key === 'Backspace') {
                            deleteAttribute('Personas', p);
                          }
                        }}
                        onMouseEnter={() => setHoveredPill({ group: 'Personas', attr: p })}
                        onMouseLeave={() => setHoveredPill(null)}
                        onFocus={() => setHoveredPill({ group: 'Personas', attr: p })}
                        onBlur={() => setHoveredPill(null)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          border: isSelected ? 'none' : `1px solid ${personaColor}`,
                          background: isSelected ? personaColor : 'transparent',
                          color: isSelected ? '#fff' : '#000',
                          padding: '10px 18px',
                          borderRadius: 6,
                          cursor: 'pointer'
                        }}
                      >
                        <span>{p}</span>
                        {(hoveredPill && hoveredPill.group === 'Personas' && hoveredPill.attr === p) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteAttribute('Personas', p); }}
                            aria-label={`Delete persona ${p}`}
                            style={{
                              background: isSelected ? 'rgba(0,0,0,0.35)' : '#333',
                              border: 'none',
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: 16,
                              padding: '4px 8px',
                              borderRadius: 6,
                              lineHeight: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginLeft: 6
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <div onClick={() => addAttribute('Personas')} style={{padding: '6px 10px', border: '1px dashed #bbb', borderRadius: 6, cursor: 'pointer'}}>+</div>
                </div>

                {
                  // Render all non-Personas demographic groups dynamically
                  Object.keys(demographics).filter(g => g !== 'Personas').map((group) => (
                    <div key={group} style={{marginBottom: 14}}>
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
                        {(editingGroup === group) ? (
                          <input
                            autoFocus
                            value={editGroupValue}
                            placeholder={group}
                            onChange={(e) => setEditGroupValue(e.target.value)}
                            onBlur={() => commitCategory(group, editGroupValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitCategory(group, editGroupValue);
                              if (e.key === 'Escape') cancelCategory();
                            }}
                            style={{padding: '6px 8px', borderRadius: 6, border: '1px solid #bbb'}}
                          />
                        ) : (
                          <div
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Delete' || e.key === 'Backspace') {
                                deleteCategory(group);
                              }
                            }}
                            onMouseEnter={() => setHoveredCategory(group)}
                            onMouseLeave={() => setHoveredCategory(null)}
                            onFocus={() => setHoveredCategory(group)}
                            onBlur={() => setHoveredCategory(null)}
                            style={{display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600}}
                          >
                            <span>{group}</span>
                            {(hoveredCategory === group) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteCategory(group); }}
                                aria-label={`Delete category ${group}`}
                                style={{background: '#333', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, padding: '4px 8px', borderRadius: 6}}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        )}
                        <div style={{display: 'flex', gap: 8}}>
                          <div style={{fontSize: 12, color: '#888'}} />
                        </div>
                      </div>
                      <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                        {(demographics[group] || []).map((a) => (
                          (editingPill && editingPill.group === group && editingPill.attr === a) ? (
                            <input
                              key={a}
                              autoFocus
                              value={editValue}
                              placeholder={a}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => commitEdit(group, a, editValue)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit(group, a, editValue);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              style={{padding: '6px 12px', borderRadius: 20, border: '1px solid #bbb'}}
                            />
                          ) : (
                            (() => {
                              const activePersona = selectedPersona || null;
                              const personaColor = activePersona ? getPersonaColor(activePersona) : '#d6a6f0';
                              const isSelected = !!(perPersonaSelections[activePersona] && perPersonaSelections[activePersona][group] && perPersonaSelections[activePersona][group].includes(a));
                              return (
                                <div
                                  key={a}
                                  tabIndex={0}
                                  onClick={() => toggleSelection(group, a)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Delete' || e.key === 'Backspace') {
                                      deleteAttribute(group, a);
                                    }
                                  }}
                                  onMouseEnter={() => setHoveredPill({ group, attr: a })}
                                  onMouseLeave={() => setHoveredPill(null)}
                                  onFocus={() => setHoveredPill({ group, attr: a })}
                                  onBlur={() => setHoveredPill(null)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '6px 12px',
                                    borderRadius: 20,
                                    border: isSelected ? 'none' : '1px solid #bbb',
                                    background: isSelected ? personaColor : 'transparent',
                                    color: isSelected ? '#fff' : '#000',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <span>{a}</span>
                                  {(hoveredPill && hoveredPill.group === group && hoveredPill.attr === a) && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteAttribute(group, a); }}
                                      aria-label={`Delete ${a} from ${group}`}
                                      style={{background: isSelected ? 'rgba(0,0,0,0.35)' : '#333', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, padding: '4px 8px', borderRadius: 6, marginLeft: 6}}
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              );
                            })()
                          )
                        ))}
                        <div onClick={() => addAttribute(group)} style={{padding: '6px 10px', border: '1px dashed #bbb', borderRadius: 6, cursor: 'pointer'}}>+</div>
                      </div>
                    </div>
                  ))
                }

                <div onClick={addCategory} style={{marginTop: 8, color: '#666', cursor: 'pointer'}}>+ New Demographic Category...</div>
              </div>
            </div>
          </div>
        );
      case 'history':
        return (
          <div style={{padding: 40}}>
            <h2>History</h2>
            <p>Placeholder for History screen.</p>
          </div>
        );
      case 'run':
        return (
          <div style={{padding: 40}}>
            <h2>Run</h2>

            <div style={{marginTop: 12}}>
              <button onClick={runSimulation} disabled={!isRunReady || generating} style={{padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', background: generating ? '#eee' : '#fff', cursor: generating ? 'not-allowed' : 'pointer'}}>
                {generating ? 'Generating...' : 'Run simulation'}
              </button>
            </div>

            {!isRunReady && (
              <div style={{marginTop: 12, color: '#666'}}>Not ready — ensure you have at least two personas, two actions, unique selections per persona, and all fields filled.</div>
            )}

            {/* Two-stage progress UI */}
            {generating && (
              <div style={{marginTop: 18, maxWidth: 680}}>
                {loadingStage === 'personas' && (
                  <div style={{marginBottom: 12}}>
                    <div style={{fontSize: 13, fontWeight: 600, marginBottom: 6}}>Generating personas</div>
                    <div style={{height: 12, background: '#eee', borderRadius: 6, overflow: 'hidden'}}>
                      <div style={{width: `${(personaProgress.total ? Math.round((personaProgress.completed || 0) / personaProgress.total * 100) : 0)}%`, height: '100%', background: '#0072B2'}} />
                    </div>
                    <div style={{fontSize: 12, color: '#666', marginTop: 6}}>{personaProgress.completed || 0} / {personaProgress.total || 0} personas</div>
                  </div>
                )}

                {loadingStage === 'decisions' && (
                  <div style={{marginBottom: 12}}>
                    <div style={{fontSize: 13, fontWeight: 600, marginBottom: 6}}>Sampling persona decisions</div>
                    <div style={{height: 12, background: '#eee', borderRadius: 6, overflow: 'hidden'}}>
                      <div style={{width: `${(decisionProgress.total ? Math.round((decisionProgress.completed || 0) / decisionProgress.total * 100) : 0)}%`, height: '100%', background: '#D55E00'}} />
                    </div>
                    <div style={{fontSize: 12, color: '#666', marginTop: 6}}>{decisionProgress.completed || 0} / {decisionProgress.total || 0} decisions</div>
                  </div>
                )}
              </div>
            )}

            {/* Show generated personas if present */}
              {generatedPersonas && generatedPersonas.length > 0 && (
                <div style={{marginTop: 20}}>
                  <h3>Generated Personas</h3>
                  <div style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}>
                    {generatedPersonas.map((r) => (
                      <div key={r.persona} style={{border: '1px solid #e6e6e6', padding: 12, borderRadius: 8, minWidth: 260}}>
                        <div style={{fontWeight: 700, marginBottom: 8}}>{r.persona}</div>
                        {r.error ? (
                          <div style={{color: 'red'}}>{r.error}</div>
                        ) : (
                          <>
                            <div style={{fontSize: 13, fontWeight: 600}}>Name</div>
                            <div style={{fontSize: 13, color: '#222', marginBottom: 8}}>{r.personaObj.name}</div>
                            <div style={{fontSize: 13, fontWeight: 600}}>Description</div>
                            <div style={{fontSize: 13, color: '#222'}}>{r.personaObj.description}</div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        );
        case 'results':
          return (
            <div style={{padding: 40}}>
              <h2>Results</h2>
              <div style={{marginTop: 8, marginBottom: 12}}>
                <button onClick={() => setView('experiment')} style={{padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer'}}>New experiment</button>
              </div>
              <p style={{marginBottom: 12}}>Generate persona actions below. This will call the backend to produce one decision per persona and render a 100% segmented bar for that action.</p>
              {simulationSignificance ? (
                <div style={{marginBottom: 12, padding: 12, borderRadius: 8, background: simulationSignificance.significant ? '#e8f7ee' : '#fff7e6', border: `1px solid ${simulationSignificance.significant ? '#c6f0d1' : '#f0d9b0'}`}}>
                  {simulationSignificance.significant ? (
                    <div style={{color: '#0b6b2e', fontWeight: 600}}>Statistically significant difference detected (p = {simulationSignificance.p_value.toFixed(4)}).</div>
                  ) : (
                    <div style={{color: '#8a5a00', fontWeight: 600}}>No statistically significant difference detected (p = {simulationSignificance.p_value.toFixed(4)}).</div>
                  )}
                  <div style={{marginTop: 8, fontSize: 13}}>
                    {simulationSignificance.attributeA} — {simulationSignificance.countA}/{simulationSignificance.totalA} chose "{simulationSignificance.action}"; {simulationSignificance.attributeB} — {simulationSignificance.countB}/{simulationSignificance.totalB} chose "{simulationSignificance.action}".
                  </div>
                </div>
              ) : simulationSummary ? (
                <div style={{marginBottom: 12}}>
                  <div style={{fontWeight: 600, marginBottom: 6}}>Simulation summary</div>
                  {simulationSummary.map(s => (
                    <div key={s.attribute} style={{fontSize: 13, color: '#333'}}>{s.attribute}: {s.mostCommon} ({s.mostCount}/{s.total})</div>
                  ))}
                </div>
              ) : (
                <div style={{marginBottom: 12}}>
                  <div style={{color: '#666', fontSize: 13}}>Actions are generated when you click Run (Setup → Run).</div>
                </div>
              )}

              <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                {(simulationSummary && simulationSummary.length ? simulationSummary : (demographics.Personas || []).map(p => ({ persona: p }))).map((s, idx) => {
                  const personaName = s.persona || s.persona;
                  const counts = s.counts || {};
                  const total = s.total || 0;
                  return (
                    <div key={personaName + idx} style={{border: '1px solid #e6e6e6', padding: 12, borderRadius: 8}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}>
                        <div style={{display: 'flex', flexDirection: 'column'}}>
                          <div style={{fontWeight: 700}}>{personaName}</div>
                          <div style={{fontSize: 13, color: '#666'}}>
                            {/** show selected demographic pills for this persona */}
                            {(() => {
                              const groups = Object.keys(demographics).filter(g => g !== 'Personas');
                              const attrs = (perPersonaSelections && perPersonaSelections[personaName]) ? groups.map(g => (perPersonaSelections[personaName][g] && perPersonaSelections[personaName][g][0]) || null).filter(Boolean) : [];
                              return attrs.length ? attrs.join(', ') : null;
                            })()}
                          </div>
                        </div>
                        <div style={{fontSize: 13, color: '#666'}}>{s.personaObj ? s.personaObj.name : ''}</div>
                      </div>
                      {(!simulationSummary || !simulationSummary.length) ? (
                        <div style={{color: '#888'}}>No action generated yet.</div>
                      ) : (
                        <div>
                          <div style={{display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6}}>
                            {availableActions.map((a, ai) => (
                              <div key={a} style={{fontSize: 13}}>{a}: {counts[a] || 0}/{total}</div>
                            ))}
                          </div>
                          <div style={{height: 28, background: '#f0f0f0', borderRadius: 6, overflow: 'hidden', display: 'flex'}}>
                            {availableActions.map((a, ai) => {
                              const pct = total ? ((counts[a] || 0) / total) : 0;
                              const width = `${Math.round(pct * 100)}%`;
                              const color = COLOR_PALETTE[ai % COLOR_PALETTE.length];
                              return <div key={a} style={{width, background: color, display: width === '0%' ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: 12}}>{width !== '0%' ? `${Math.round(pct * 100)}%` : null}</div>;
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
      case 'leaderboard':
        return (
          <div style={{padding: 40}}>
            <h2>Leaderboard</h2>
            <p>Placeholder for Leaderboard screen.</p>
          </div>
        );
      case 'tutorial':
        return (
          <div style={{padding: 40}}>
            <h2>Tutorial</h2>
            <p>Placeholder for Tutorial screen.</p>
          </div>
        );
      case 'persona':
        return (
          <div style={{padding: 40}}>
            <h2>Persona playground</h2>
            <p>Placeholder area for the persona playground.</p>
          </div>
        );
      default:
        return (
          <div style={{padding: 40}}>
            <h2>Welcome to our study</h2>
            <p>Use the left navigation to explore different sections.</p>
          </div>
        );
    }
  };

  return (
    <div style={{display: 'flex', height: '100vh', fontFamily: 'Inter, system-ui, Arial, sans-serif'}}>
      <nav style={navStyle}>
        <div style={{fontWeight: 600, marginBottom: 8}}>Persona playground</div>

        <div>
          <div style={{marginBottom: 12, color: '#666', fontSize: 14}}>Experiment</div>
          <div style={{display: 'flex', gap: 12}}>
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              <div style={{width: 2, height: 8, background: '#ccc'}} />
              <button onClick={() => setView('experiment')} aria-label="Setup" style={{background: 'transparent', border: 'none', padding: 8, cursor: 'pointer'}}>
                <div style={circle(view === 'experiment')}></div>
              </button>
              <div style={{width: 2, height: 36, background: '#ccc'}} />
              <button onClick={() => setView('run')} aria-label="Run" style={{background: 'transparent', border: 'none', padding: 8, cursor: 'pointer'}}>
                <div style={circle(view === 'run')}></div>
              </button>
              <div style={{width: 2, height: 36, background: '#ccc'}} />
              <button onClick={() => setView('results')} aria-label="Results" style={{background: 'transparent', border: 'none', padding: 8, cursor: 'pointer'}}>
                <div style={circle(view === 'results')}></div>
              </button>
            </div>
              <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
              <button onClick={() => setView('experiment')} style={{background: 'transparent', border: 'none', textAlign: 'left', padding: '8px 4px', cursor: 'pointer'}}>Setup</button>
              <button onClick={() => setView('run')} style={{background: 'transparent', border: 'none', textAlign: 'left', padding: '8px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8}}>Run{isRunReady && <span style={{marginLeft: 8, background: '#28a745', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 12}}>ready</span>}</button>
              <button onClick={() => setView('results')} style={{background: 'transparent', border: 'none', textAlign: 'left', padding: '8px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8}}>Results{isResultsReady && <span style={{marginLeft: 8, background: '#28a745', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 12}}>ready</span>}</button>
            </div>
          </div>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
          <button onClick={() => setView('history')} style={{background: 'transparent', border: 'none', padding: 6, textAlign: 'left', cursor: 'pointer'}}>History</button>
          <button onClick={() => setView('leaderboard')} style={{background: 'transparent', border: 'none', padding: 6, textAlign: 'left', cursor: 'pointer'}}>Leaderboard</button>
          <button onClick={() => setView('tutorial')} style={{background: 'transparent', border: 'none', padding: 6, textAlign: 'left', cursor: 'pointer'}}>Tutorial</button>
        </div>

        <div style={{marginTop: 'auto', fontSize: 12, color: '#999'}}>Previous UI preserved in src/OldApp.jsx</div>
      </nav>

      <main style={{flex: 1, background: '#fff', display: 'flex', flexDirection: 'column'}}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          borderBottom: '1px solid #eee',
          boxSizing: 'border-box',
          background: '#fafafa'
        }}>
          <div style={{fontSize: 16, fontWeight: 600}}>
            {{
              welcome: 'Welcome',
              experiment: 'Experiment setup',
              history: 'History',
              leaderboard: 'Leaderboard',
              tutorial: 'Tutorial',
              persona: 'Persona playground'
            }[view] || 'Page'}
          </div>
          <div style={{display: 'flex', gap: 12}}>
            <button onClick={() => {}} style={{padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer'}}>Get reward</button>
            <button onClick={() => {}} style={{padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer'}}>Log out</button>
          </div>
        </div>

        <div style={{flex: 1, overflow: 'auto'}}>
          {renderMain()}
        </div>
      </main>
    </div>
  );
}