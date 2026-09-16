import { useState } from "react";
import { Setup } from "./screens/Setup";
import { Assessment } from "./screens/Assessment";
import { Report } from "./screens/Report";

type Screen = "setup" | "assessment" | "report";

export function App() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <div className="app-shell">
      <div className="brand-row">
        <div className="brand-badge">L</div>
        <div>
          <div className="brand-name">LifeHub Foundations</div>
        </div>
      </div>

      {screen === "setup" && (
        <Setup
          onStart={(id) => {
            setSessionId(id);
            setScreen("assessment");
          }}
        />
      )}
      {screen === "assessment" && sessionId && (
        <Assessment sessionId={sessionId} onComplete={() => setScreen("report")} />
      )}
      {screen === "report" && sessionId && <Report sessionId={sessionId} />}
    </div>
  );
}
