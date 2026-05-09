import { useState, useEffect } from 'react'

function scoreStyle(score) {
  if (score >= 85) return { color: '#52b788', track: '#1a3d28', label: 'Excellent' }
  if (score >= 70) return { color: '#7bc8a0', track: '#1e3530', label: 'Good' }
  if (score >= 50) return { color: '#f0a050', track: '#3a2010', label: 'Fair' }
  return { color: '#e05252', track: '#3a1414', label: 'Needs Attention' }
}

function ScoreRing({ score }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const { color, track, label } = scoreStyle(score)
  const [animatedFilled, setAnimatedFilled] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setAnimatedFilled(filled), 50)
    return () => clearTimeout(t)
  }, [filled])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
      <div style={{ position: 'relative', width: '128px', height: '128px' }}>
        <svg width="128" height="128" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="64" cy="64" r={radius} fill="none" stroke={track} strokeWidth="14" />
          <circle
            cx="64" cy="64" r={radius}
            fill="none" stroke={color} strokeWidth="14"
            strokeDasharray={`${animatedFilled} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.9s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
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
      </div>
      <div style={{ marginTop: '12px' }}>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: '0.65rem', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color, background: track,
          border: `1px solid ${color}`,
          borderRadius: '999px',
          padding: '4px 14px',
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
  const {
    biller_score, total_peer_expected, total_paid, leakage_dollars, leakage_pct,
    total_claims, flagged_claims,
    claims_with_contract, contracted_leakage_dollars, contracted_leakage_pct,
  } = summary

  const baseKpis = [
    { label: 'Expected',  value: fmt(total_peer_expected), color: 'var(--primary-light)' },
    { label: 'Collected', value: fmt(total_paid),              color: 'var(--green)' },
    { label: 'Leakage',   value: fmt(leakage_dollars),         color: 'var(--red)' },
    { label: 'Leak Rate', value: `${leakage_pct}%`,            color: 'var(--red)' },
    { label: 'Claims',    value: total_claims,                  color: 'var(--text-bright)' },
    { label: 'Flagged',   value: flagged_claims,                color: 'var(--amber)' },
  ]
  const contractKpis = (claims_with_contract && claims_with_contract > 0) ? [
    { label: 'Contract Claims', value: claims_with_contract, color: 'var(--text-bright)' },
    {
      label: 'Contract Leak',
      value: fmt(contracted_leakage_dollars),
      color: contracted_leakage_dollars > 0 ? 'var(--red)' : 'var(--green)',
    },
    {
      label: 'Contract Rate',
      value: `${contracted_leakage_pct}%`,
      color: contracted_leakage_pct > 0 ? 'var(--red)' : 'var(--green)',
    },
  ] : []
  const kpis = [...baseKpis, ...contractKpis]

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
