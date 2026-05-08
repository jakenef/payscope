function ScoreRing({ score }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
  const label = score >= 80 ? 'Good' : score >= 60 ? 'Warning' : 'Critical'

  return (
    <div className="flex flex-col items-center">
      <svg width="136" height="136" className="-rotate-90">
        <circle cx="68" cy="68" r={radius} fill="none" stroke="#1e293b" strokeWidth="12" />
        <circle
          cx="68" cy="68" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="flex flex-col items-center -mt-20">
        <span className="text-4xl font-bold" style={{ color }}>{score}</span>
        <span className="text-slate-400 text-xs uppercase tracking-wide">/ 100</span>
      </div>
      <span
        className="mt-3 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
        style={{ color, background: `${color}22` }}
      >
        {label}
      </span>
    </div>
  )
}

function KpiRow({ label, value, color }) {
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-slate-700/50">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  )
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function ScoreSidebar({ summary }) {
  const { biller_score, total_medicare_expected, total_paid, leakage_dollars, leakage_pct, total_claims, flagged_claims } = summary

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 flex flex-col gap-4 min-w-[220px]">
      <h2 className="text-slate-300 text-sm font-semibold uppercase tracking-widest text-center">
        Biller Score
      </h2>
      <ScoreRing score={biller_score} />
      <div className="mt-2">
        <KpiRow label="Expected"  value={fmt(total_medicare_expected)} color="text-blue-400" />
        <KpiRow label="Collected" value={fmt(total_paid)}              color="text-emerald-400" />
        <KpiRow label="Leakage"   value={fmt(leakage_dollars)}         color="text-red-400" />
        <KpiRow label="Leak rate" value={`${leakage_pct}%`}           color="text-red-400" />
        <KpiRow label="Claims"    value={total_claims}                  color="text-slate-300" />
        <KpiRow label="Flagged"   value={flagged_claims}                color="text-amber-400" />
      </div>
    </div>
  )
}
