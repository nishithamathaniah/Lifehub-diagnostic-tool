const OPTIONS: { value: string; emoji: string }[] = [
  { value: "easy", emoji: "\u{1F60A}" },
  { value: "okay", emoji: "\u{1F610}" },
  { value: "hard", emoji: "\u{1F61F}" },
];

export function PulseCheck({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="pulse-row">
      <span>How did that feel?</span>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`pulse-btn ${value === opt.value ? "selected" : ""}`}
          onClick={() => onChange(opt.value)}
          aria-label={opt.value}
        >
          {opt.emoji}
        </button>
      ))}
    </div>
  );
}
