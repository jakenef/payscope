function scoreStyle(score) {
  if (score >= 80) return { color: '#52b788', track: '#1a3d28', label: 'Satisfactory' }
  if (score >= 60) return { color: '#f0a050', track: '#3a2010', label: 'Warning' }
  return { color: '#e05252', track: '#3a1414', label: 'Critical' }
}

function ScoreRing({ score }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const { color, track, label } = scoreStyle(score)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
      <svg width="128" height="128" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="64" cy="64" r={radius} fill="none" stroke={track} strokeWidth="10" />
        <circle
          cx="64" cy="64" r={radius}
          fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.9s ease' }}
        />
      </svg>
      <div style={{ marginTop: '-72px', textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '2.6rem', color, lineHeight: 1,
        }}>
          {score}
        </div>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: '0.6rem', fontWeight: 500,
          color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: '2px',
        }}>
          / 100
        </div>
      </div>
      <div style={{ marginTop: '12px' }}>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: '0.65rem', fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color, background: track,
          border: `1px solid ${color}`,
          padding: '2px 12px',
        }}>
          {label}
        </span>
      </div>
    </div>
  )
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function ScoreSidebar({ summary }) {
  const { biller_score, total_medicare_expected, total_paid, leakage_dollars, leakage_pct, total_claims, flagged_claims } = summary

  const kpis = [
    { label: 'Expected',  value: fmt(total_medicare_expected), color: 'var(--primary-light)' },
    { label: 'Collected', value: fmt(total_paid),              color: 'var(--green)' },
    { label: 'Leakage',   value: fmt(leakage_dollars),         color: 'var(--red)' },
    { label: 'Leak Rate', value: `${leakage_pct}%`,            color: 'var(--red)' },
    { label: 'Claims',    value: total_claims,                  color: 'var(--text-bright)' },
    { label: 'Flagged',   value: flagged_claims,                color: 'var(--amber)' },
  ]

  return (
    <div className="panel" style={{ minWidth: '210px', flexShrink: 0 }}>
      <div className="panel-header">
        Biller Score
        <span className="panel-tag">BPI</span>
      </div>
      <div style={{ padding: '16px' }}>
        <ScoreRing score={biller_score} />
        <hr className="section-rule" style={{ margin: '14px 0' }} />
        {kpis.map(({ label, value, color }) => (
          <div className="kpi-row" key={label}>
            <span className="kpi-label">{label}</span>
            <span className="kpi-value" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
