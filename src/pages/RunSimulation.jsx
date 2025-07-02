import { useState, useRef, useEffect } from "react";

export default function RunSimulation({
  step1Confirmed,
  step2Confirmed,
  setSimulationCompleted,
}) {
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState("Run Simulation");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const pollingIntervalRef = useRef(null);
  const simulationIdRef = useRef(null);

  const runFullSimulation = async () => {
    if (!step1Confirmed || !step2Confirmed) {
      return;
    }

    setSimulationCompleted(false);
    setLoading(true);
    setStatusLabel("Running...");
    setProgress(0);
    setCaption("");
    setError("");

    const attributes = JSON.parse(localStorage.getItem("attributesList") || "[]");

    const payload = {
      scenario: localStorage.getItem("scenario"),
      context: localStorage.getItem("context"),
      actionSpace: localStorage.getItem("actionSpace"),
      demographicGroup: localStorage.getItem("demographicGroup"),
      attributesList: attributes,
    };

    try {
      const res = await fetch("http://localhost:5000/generate_persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.status !== 202 || !data.simulationId) {
        throw new Error(data.message || "Failed to start simulation.");
      }

      simulationIdRef.current = data.simulationId;
      setCaption("Simulation started, fetching updates...");

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const progressRes = await fetch(`http://localhost:5000/simulation_progress/${simulationIdRef.current}`);
          const progressData = await progressRes.json();

          if (progressData.status === 'completed') {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            setProgress(100);
            setCaption("Simulation complete, fetching results...");

            const resultsRes = await fetch(`http://localhost:5000/simulation_results/${simulationIdRef.current}`);
            const resultsData = await resultsRes.json();

            if (!resultsRes.ok || !Array.isArray(resultsData.agents)) {
              throw new Error(resultsData.message || "Failed to retrieve simulation results.");
            }

            const actualCount = resultsData.agents.length;
            setCaption(`${actualCount} persona actions retrieved`);
            setStatusLabel("Run Again");
            localStorage.setItem("agentsArray", JSON.stringify(resultsData.agents));
            setLoading(false);
            setSimulationCompleted(true);
          } else if (progressData.status === 'running') {
            const currentProgress = (progressData.completed / progressData.total) * 100;
            setProgress(currentProgress);
            setCaption(`Processing ${progressData.completed} of ${progressData.total} agents...`);
          } else {
            console.warn("Unexpected progress status:", progressData.status);
            setError("Unexpected simulation status. Check console.");
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            setLoading(false);
            setStatusLabel("Retry Simulation");
          }
        } catch (pollErr) {
          console.error("Error during polling:", pollErr);
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          setError("Polling error. Check console for details.");
          setLoading(false);
          setStatusLabel("Retry Simulation");
        }
      }, 1000);
    } catch (err) {
      console.error("Error starting simulation:", err);
      setError("Simulation failed to start. Check backend or network.");
      setStatusLabel("Retry Simulation");
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // const isReady = step1Confirmed && step2Confirmed;

  return (
  <div className="page-2">
    {error && <p style={{ color: "red", marginBottom: "10px" }}>{error}</p>}

    <button
      onClick={runFullSimulation}
      disabled={!step1Confirmed || !step2Confirmed || loading}
      style={{
        backgroundColor: !step1Confirmed || !step2Confirmed
          ? "#ccc"
          : loading
          ? "#ccc"
          : "#b9eb98",
        color: "black",
        cursor: !step1Confirmed || !step2Confirmed ? "not-allowed" : "pointer",
        
      }}
    >
      ▶ {!step1Confirmed || !step2Confirmed
        ? "Confirm Simulation Setup"
        : loading
        ? "Starting..."
        : statusLabel}
    </button>

    <progress
      value={progress}
      max="100"
      style={{ width: "100%", marginTop: "10px" }}
    />

    {caption && <p style={{ fontSize: "0.9em", color: "#555" }}>{caption}</p>}
  </div>
);

}
