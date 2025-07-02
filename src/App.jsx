// App.jsx
import { useRef, useState } from "react";
import SetupPage from "./pages/SetupPage"; 
import Results from "./pages/Results";
import RunSimulation from "./pages/RunSimulation";
import "./index.css"; 

export default function App() {
  const scrollRef = useRef(null);
  // Combined state for both setup steps
  const [setupConfirmed, setSetupConfirmed] = useState(false);
  const [simulationCompleted, setSimulationCompleted] = useState(false);


  const scrollToSection = (index) => {
    const width = window.innerWidth;
    scrollRef.current?.scrollTo({ left: index * width, behavior: "smooth" });
  };

  return (
    <div className="scroll-container" ref={scrollRef}>
      {/* Step 0: Combined Setup Page */}
      <div className="section">
        <SetupPage scrollToSection={scrollToSection} setSetupConfirmed={setSetupConfirmed} />
      </div>
      <div className="arrow">➡</div>
      {/* Step 1: Run Simulation */}
      <div className="section">
        <RunSimulation
          scrollToSection={scrollToSection}
          step1Confirmed={setupConfirmed} // Now depends on combined setupConfirmed
          step2Confirmed={setupConfirmed} // Both steps are confirmed together
          setSimulationCompleted={setSimulationCompleted}
        />
      </div>
      <div className="arrow">➡</div>
      {/* Step 2: Results */}
      <div className="section">
        <Results
          scrollToSection={scrollToSection}
          simulationCompleted={simulationCompleted}
        />
      </div>
    </div>
  );
}
