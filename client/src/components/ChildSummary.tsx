import { ReportData, TopicDiagnosis } from "../types";

// Plain, warm, Grade-5-reading-level translations of each diagnosis tag.
// No jargon (no "skill gap", "CPA", "Bloom's", hesitation stats, etc.) —
// this is written directly to the child, not the parent/teacher report below it.
function practiceMessage(t: TopicDiagnosis): string {
  switch (t.tag) {
    case "skill_gap":
      return `Let's go back and practice ${t.name} a bit more with your teacher or a grown-up. Getting this one solid will make the next topics much easier.`;
    case "procedural_not_conceptual":
      return `You're really good at solving ${t.name} with numbers! Next, let's practice drawing it too (like a picture or a bar model) — that helps you understand it even deeper.`;
    case "anxiety_flagged":
      return `You actually know ${t.name} really well! It just felt extra tricky in the moment. Try it again when you're relaxed and not rushing — you've got this.`;
    default:
      return `Let's keep practicing ${t.name}.`;
  }
}

export function ChildSummary({ report, childName }: { report: ReportData; childName: string }) {
  const mastered = report.topics.filter((t) => t.tag === "mastered");
  const toPractice = report.topics.filter(
    (t) => t.tag === "skill_gap" || t.tag === "procedural_not_conceptual" || t.tag === "anxiety_flagged"
  );

  return (
    <div className="child-summary">
      <h2 className="serif">Great work today, {childName}! 🌟</h2>

      {mastered.length > 0 && (
        <div className="child-block">
          <div className="child-block-title">You're already great at:</div>
          <ul className="child-list good">
            {mastered.map((t) => (
              <li key={t.topicId}>✅ {t.name}</li>
            ))}
          </ul>
        </div>
      )}

      {toPractice.length > 0 && (
        <div className="child-block">
          <div className="child-block-title">What to practice next:</div>
          <ul className="child-list practice">
            {toPractice.map((t) => (
              <li key={t.topicId}>🌱 {practiceMessage(t)}</li>
            ))}
          </ul>
        </div>
      )}

      {toPractice.length === 0 && mastered.length > 0 && (
        <p className="child-allgood">You did great across everything we tried today — keep it up!</p>
      )}
    </div>
  );
}
