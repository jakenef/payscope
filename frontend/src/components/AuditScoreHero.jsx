function scoreStyle(score) {
  if (score >= 80)
    return { color: "#52b788", track: "#1a3d28", label: "Satisfactory" };
  if (score >= 60)
    return { color: "#f0a050", track: "#3a2010", label: "Warning" };
  return { color: "#e05252", track: "#3a1414", label: "Critical" };
}

function ScoreRing({ score }) {
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const { color, track, label } = scoreStyle(score);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <div style={{ position: "relative", width: "196px", height: "196px" }}>
        <svg width="196" height="196" style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx="98"
            cy="98"
            r={radius}
            fill="none"
            stroke={track}
            strokeWidth="12"
          />
          <circle
            cx="98"
            cy="98"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeDasharray={`${filled} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.9s ease" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "3.6rem",
              color,
              lineHeight: 1,
            }}
          >
            {score}
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.7rem",
              fontWeight: 500,
              color: "var(--text-muted)",
              letterSpacing: "0.08em",
              marginTop: "4px",
            }}
          >
            / 100
          </div>
        </div>
      </div>
      <div style={{ marginTop: "14px" }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.65rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color,
            background: track,
            border: `1px solid ${color}`,
            padding: "3px 14px",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

function fmt(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function AuditScoreHero({ summary }) {
  const {
    biller_score,
    total_medicare_expected,
    total_paid,
    leakage_dollars,
    date_range,
  } = summary;
  const collectionPct =
    total_medicare_expected > 0
      ? Math.round((total_paid / total_medicare_expected) * 100)
      : 0;

  return (
    <div className="panel">
      <div className="panel-header">
        Audit Score
        <span className="panel-tag">BPI</span>
      </div>
      <div
        style={{
          padding: "20px 28px",
          display: "flex",
          alignItems: "center",
          gap: "36px",
        }}
      >
        <ScoreRing score={biller_score} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "2.65rem",
              color: "var(--text-bright)",
              lineHeight: 1.3,
            }}
          >
            You billed{" "}
            <span style={{ color: "var(--primary-light)", fontSize: "3.1rem" }}>
              {fmt(total_medicare_expected)}
            </span>{" "}
            and collected{" "}
            <span style={{ color: "var(--green)", fontSize: "3.1rem" }}>{fmt(total_paid)}</span> —
            recovering{" "}
            <span style={{ color: "var(--primary-light)", fontSize: "3.1rem" }}>
              {collectionPct}%
            </span>{" "}
            of what you billed{date_range ? ` from ${date_range}.` : "."}
          </div>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "2.1rem",
              color: "var(--text-muted)",
              lineHeight: 1.3,
              marginTop: "12px",
            }}
          >
            You left{" "}
            <span style={{ color: "var(--red)", fontSize: "2.5rem" }}>{fmt(leakage_dollars)}</span>{" "}
            on the table.
          </div>
        </div>
      </div>
    </div>
  );
}
