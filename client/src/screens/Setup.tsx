import { useState } from "react";
import { createSession } from "../api";

export function Setup({ onStart }: { onStart: (sessionId: string) => void }) {
  const [childName, setChildName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!childName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const sessionId = await createSession(childName.trim(), "Grade 5");
      onStart(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="setup-wrap">
      <h1>Dynamic Math Diagnostic</h1>
      <p className="lede">
        A short, ordinary-looking set of Grade 5 maths questions. Behind the scenes, it separates a genuine skill
        gap from anxiety and from a memorized-but-not-understood procedure &mdash; without ever telling your child
        it's doing that.
      </p>
      <form className="setup-form card" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="childName">Child's first name</label>
          <input
            id="childName"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="e.g. Aanya"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="grade">Grade</label>
          <select id="grade" defaultValue="Grade 5" disabled>
            <option>Grade 5</option>
          </select>
        </div>
        {error && <div style={{ color: "var(--soft-clay)", fontSize: "0.85rem" }}>{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={loading || !childName.trim()}>
          {loading ? "Starting…" : "Start assessment"}
        </button>
      </form>
    </div>
  );
}
