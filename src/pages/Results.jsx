// src/pages/Results.jsx
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from "recharts";

export default function Results({ simulationCompleted }) {
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (simulationCompleted && localStorage.getItem("agentsArray")) {
      try {
        const agentsData = JSON.parse(localStorage.getItem("agentsArray") || "[]");

        if (!Array.isArray(agentsData) || agentsData.length === 0) {
          setError("No simulation data found");
        } else {
          setAgents(agentsData);
          setError(null);
        }
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load simulation data");
      }
    } else {
      setError("Results will be shown here.");
      setAgents([]);
    }
  }, [simulationCompleted]);

  // const handleRestart = () => {
  //   localStorage.clear();
  //   location.reload(); // fully reset the app
  // };

  const chartData = (() => {
    const grouped = {};
    agents.forEach(({ attribute, result }) => {
      if (!attribute || !result?.decision) return;
      if (!grouped[attribute]) grouped[attribute] = {};
      grouped[attribute][result.decision] = (grouped[attribute][result.decision] || 0) + 1;
    });

    return Object.entries(grouped).map(([attribute, decisions]) => {
      const total = Object.values(decisions).reduce((sum, count) => sum + count, 0);
      const percentages = {};
      for (const decision in decisions) {
        percentages[decision] = (decisions[decision] / total) * 100;
      }
      return { attribute, ...percentages };
    });
  })();

  const uniquedecisions = Array.from(new Set(agents.map(a => a.result?.decision).filter(Boolean)));

  if (error) {
    return (
      <div className="page-2">
        <p style={{ color: "gray", textAlign: "center" }}>{error}</p>
        {/* <button onClick={handleRestart}>Reset App</button> */}
      </div>
    );
  }

  if (agents.length === 0) {
    return (  
      <div className="page-2" style={{textAlign: "center"}}>
        <p>Results will be shown here.</p>
        {/* <button onClick={handleRestart}>Reset App</button> */}
      </div>
    );
  }

  return (
  <div className="page-3">
    <div style={{ display: "flex", gap: "20px", maxHeight: "82vh", alignItems: "center" }}>
      <div style={{ flex: 2, height: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="attribute" />
            <Tooltip
              formatter={(value, name) => [`${value.toFixed(1)}%`, name]}
              content={({ payload, label }) => {
                if (!payload || payload.length === 0) return null;

                return (
                  <div style={{ backgroundColor: "white", border: "1px solid #ccc", padding: "10px", fontSize: "0.75rem" }}>
                    <strong>{label}</strong>
                    <br />
                    {payload.map((entry, i) => {
                      const rawCount = agents.filter(
                        (a) => a.attribute === label && a.result?.decision === entry.name
                      ).length;

                      return (
                        <div key={i}>
                          <span style={{ color: entry.color, fontWeight: 600 }}>{entry.name}</span>: {rawCount} agents
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
            <Legend />
            {uniquedecisions.map((decision, idx) => (
              <Bar
                key={decision}
                dataKey={decision}
                stackId="a"
                fill={["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d"][idx % 7]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          flex: 1,
          maxHeight: "90%",
          overflowY: "auto",
          border: "1px solid #ccc",
          padding: "10px",
          borderRadius: "6px",
          backgroundColor: "#fff",
          marginBottom: "10px",
          marginTop: "10px"
        }}
      >
        <h3>Individual Persona Results</h3>
        {agents.map((agent, idx) => (
          <div key={idx} style={{ marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid #eee" }}>
            <strong>{agent.persona?.name || "Unnamed"}</strong> ({agent.attribute})<br />
            <strong>decision:</strong> {agent.result?.decision || "N/A"}<br />
            <strong>Rationale:</strong> <span style={{ color: "#555" }}>{agent.result?.rationale || "N/A"}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);
}