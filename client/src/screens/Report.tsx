import { useEffect, useState } from "react";
import { getReport } from "../api";
import { ReportData } from "../types";
import { BloomPyramid } from "../components/BloomPyramid";

const STRAND_SUB: Record<string, string> = {
  "Number & Algebra": "Whole numbers, four operations, fractions, decimals",
  "Measurement & Geometry": "Area of triangle, volume, angles",
  "Ratio & Proportion": "Percentage, rate",
};

const TAG_LABEL: Record<string, string> = {
  mastered: "Mastered",
  skill_gap: "Skill gap",
  procedural_not_conceptual: "Procedural, not conceptual",
  anxiety_flagged: "Anxiety-flagged",
  not_yet_reached: "Not yet reached",
};

export function Report({ sessionId }: { sessionId: string }) {
  const [report, setReport] = useState<ReportData | null>(null);

  useEffect(() => {
    getReport(sessionId).then(setReport);
  }, [sessionId]);

  if (!report) return <div className="app-shell">Generating report…</div>;

  const deepDiveTopics = report.topics.filter((t) => t.tag !== "mastered" && t.tag !== "not_yet_reached");

  return (
    <div>
      <div className="report-top">
        <div>
          <div className="report-meta">
            Assessed {new Date(report.assessedAt).toLocaleDateString()} &middot; {report.questionCount} questions &middot;{" "}
            {report.durationMinutes} min
          </div>
          <h1 className="headline">{report.headline}</h1>
        </div>
        <div className="report-actions">
          <button className="btn btn-secondary" onClick={() => window.print()}>
            Download PDF
          </button>
        </div>
      </div>

      <div className="report-hero">
        <div className="card">
          <p className="subheadline" style={{ marginTop: 0 }}>
            {report.subheadline}
          </p>
        </div>
        <div className="summary-cards">
          <div className="summary-card mastered">
            <span>Topics mastered</span>
            <span className="num">
              {report.summary.mastered} / {report.summary.total}
            </span>
          </div>
          <div className="summary-card skill">
            <span>Skill lag identified</span>
            <span className="num">{report.summary.skillGap} topic</span>
          </div>
          <div className="summary-card procedural">
            <span>Procedural, not conceptual</span>
            <span className="num">{report.summary.proceduralNotConceptual} topic</span>
          </div>
          <div className="summary-card anxiety">
            <span>Anxiety-flagged</span>
            <span className="num">{report.summary.anxietyFlagged} topic</span>
          </div>
        </div>
      </div>

      <div className="panel-title" style={{ marginBottom: 10 }}>
        Bloom's depth reached, by strand
      </div>
      <div className="pyramid-row">
        {report.bloomByStrand.map((s) => (
          <BloomPyramid
            key={s.strand}
            strand={s.strand}
            sub={STRAND_SUB[s.strand] ?? ""}
            assessed={s.assessed}
            deepest={s.deepest}
          />
        ))}
      </div>

      <div className="panel-title" style={{ marginBottom: 10 }}>
        Topic-by-topic map
      </div>
      <table className="topic-table">
        <thead>
          <tr>
            <th>Topic</th>
            <th>Bloom ceiling</th>
            <th>Diagnosis</th>
            <th>CPA gap</th>
          </tr>
        </thead>
        <tbody>
          {report.topics.map((t) => (
            <tr key={t.topicId}>
              <td>
                <div className="topic-name">{t.name}</div>
              </td>
              <td className="topic-sub">{t.bloomCeiling ?? "—"}</td>
              <td>
                <span className={`dx-pill dx-${t.tag}`}>{TAG_LABEL[t.tag]}</span>
              </td>
              <td className="topic-sub">{t.cpaGapNote}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {deepDiveTopics.length > 0 && (
        <>
          <div className="panel-title" style={{ marginBottom: 10 }}>
            Patterns worth a closer look
          </div>
          <div className="deepdive-grid">
            {deepDiveTopics.map((t) => (
              <div className="deepdive-card" key={t.topicId}>
                <div className="dd-head">
                  <strong>{t.name}</strong>
                  <span className={`dx-pill dx-${t.tag}`}>{TAG_LABEL[t.tag]}</span>
                </div>
                <div className="evidence-box">
                  {t.evidence.map((e, i) => (
                    <p key={i} style={{ margin: i === 0 ? 0 : "6px 0 0" }}>
                      {e}
                    </p>
                  ))}
                </div>
                <div className="recommendation">&rarr; {t.recommendation}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="glossary-box">
        <b>How to read this report:</b>{" "}
        {report.glossary.map((g, i) => (
          <span key={g.tag}>
            "{g.label}" means {g.description[0].toLowerCase() + g.description.slice(1)}
            {i < report.glossary.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
