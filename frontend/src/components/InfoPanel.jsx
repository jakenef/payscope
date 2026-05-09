function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function InfoPanel({ summary }) {
  const { total_claims, flagged_claims, leakage_pct, leakage_dollars, date_range } = summary

  const kpis = [
    { label: 'Claims',    value: total_claims,          color: 'var(--text-bright)' },
    { label: 'Flagged',   value: flagged_claims,         color: 'var(--amber)' },
    { label: 'Leak Rate', value: `${leakage_pct}%`,      color: 'var(--red)' },
    { label: 'Leakage',   value: fmt(leakage_dollars),   color: 'var(--red)' },
  ]

  return (
    <div className="panel" style={{ minWidth: '180px', flexShrink: 0 }}>
      <div className="panel-header">
        Overview
      </div>
      <div style={{ padding: '12px 16px' }}>
        {date_range && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.04em',
            marginBottom: '10px',
            paddingBottom: '10px',
            borderBottom: '1px solid var(--text-dim)',
          }}>
            {date_range}
          </div>
        )}
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
