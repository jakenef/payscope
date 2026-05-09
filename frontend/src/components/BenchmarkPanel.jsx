/**
 * BenchmarkPanel — "How I compare to practices in my area"
 *
 * Renders peer comparison metrics from result.benchmarks. For each metric we
 * draw a horizontal range bar with markers for p25, median, p75 and the user's
 * value, plus a percentile label.
 */
export default function BenchmarkPanel({ benchmarks, onEditProfile }) {
  if (!benchmarks) return <MissingProfileCard onEditProfile={onEditProfile} />

  const { specialty, state, cohort_size, metrics } = benchmarks

  return (
    <div className="panel">
      <div className="panel-header">
        How you compare in your area
        <span className="panel-tag">
          {specialty}{state ? ` · ${state}` : ''} · n={cohort_size}
        </span>
      </div>
      <div style={{ padding: '18px 18px 14px' }}>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: '0.74rem',
          color: 'var(--text-muted)', lineHeight: 1.55,
          marginBottom: '20px',
        }}>
          Benchmarked against {cohort_size} {specialty} practices
          {state ? ` in ${state}` : ''}. Bars show the 25th–75th percentile range;
          the line is the median.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {metrics.map((m) => <MetricRow key={m.key} m={m} />)}
        </div>
      </div>
    </div>
  )
}

function MetricRow({ m }) {
  const { label, user, p25, median, p75, percentile, higher_is_better, unit } = m
  const hasUser = user !== null && user !== undefined

  // Domain for the bar: span around the IQR + user value with padding.
  const allPoints = [p25, median, p75, ...(hasUser ? [user] : [])]
  const minVal = Math.min(...allPoints)
  const maxVal = Math.max(...allPoints)
  const pad = (maxVal - minVal) * 0.18 || 1
  const domainMin = Math.max(0, minVal - pad)
  const domainMax = maxVal + pad
  const span = domainMax - domainMin || 1

  const pct = (v) => `${((v - domainMin) / span) * 100}%`

  // Color logic: green if user beats median, amber if in IQR, red if outside
  const userColor = !hasUser
    ? 'var(--text-muted)'
    : (higher_is_better ? user >= median : user <= median)
      ? 'var(--green)'
      : (higher_is_better ? user >= p25 : user <= p75)
        ? 'var(--amber)'
        : 'var(--red)'

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: '8px',
      }}>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: '0.78rem',
          color: 'var(--text-bright)', fontWeight: 500,
        }}>
          {label}
        </div>
        {hasUser && (
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: '0.7rem',
            color: 'var(--text-muted)',
          }}>
            <span style={{ color: userColor, fontWeight: 600 }}>
              {fmt(user, unit)}
            </span>
            {' · '}
            <span>{percentileLabel(percentile, higher_is_better)}</span>
          </div>
        )}
      </div>

      {/* range bar */}
      <div style={{
        position: 'relative', height: '18px',
        background: 'var(--bg-dark)',
        border: '1px solid var(--text-dim)',
      }}>
        {/* IQR band */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: pct(p25), width: `calc(${pct(p75)} - ${pct(p25)})`,
          background: 'rgba(42,157,143,0.22)',
          borderLeft: '1px solid rgba(42,157,143,0.5)',
          borderRight: '1px solid rgba(42,157,143,0.5)',
        }} />
        {/* median tick */}
        <div style={{
          position: 'absolute', top: '-2px', bottom: '-2px',
          left: pct(median), width: '2px',
          background: 'var(--primary-light)',
        }} />
        {/* user marker */}
        {hasUser && (
          <div style={{
            position: 'absolute', top: '-5px', bottom: '-5px',
            left: `calc(${pct(user)} - 4px)`,
            width: '8px',
            background: userColor,
            border: '1px solid var(--bg)',
            boxShadow: '0 0 0 1px ' + userColor,
          }} title={`Your value: ${fmt(user, unit)}`} />
        )}
      </div>

      {/* axis labels */}
      <div style={{
        position: 'relative', height: '14px', marginTop: '4px',
        fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
        color: 'var(--text-muted)',
      }}>
        <span style={{ position: 'absolute', left: pct(p25), transform: 'translateX(-50%)' }}>
          {fmt(p25, unit)}
        </span>
        <span style={{ position: 'absolute', left: pct(median), transform: 'translateX(-50%)', color: 'var(--primary-light)' }}>
          {fmt(median, unit)}
        </span>
        <span style={{ position: 'absolute', left: pct(p75), transform: 'translateX(-50%)' }}>
          {fmt(p75, unit)}
        </span>
      </div>
    </div>
  )
}

function fmt(v, unit) {
  if (v === null || v === undefined) return '—'
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(n)) return String(v)
  const formatted = Number.isInteger(n) ? n.toString() : n.toFixed(1)
  return `${formatted}${unit || ''}`
}

function percentileLabel(p, higherIsBetter) {
  // p is always "what % of peers you outscore on the raw value, sorted ascending".
  // For higher-is-better metrics: p=80 means "better than 80% of peers".
  // For lower-is-better metrics: backend already inverts so p=80 still means good.
  const verb = p >= 75 ? 'top' : p >= 50 ? 'above' : p >= 25 ? 'below' : 'bottom'
  if (verb === 'top')    return `top ${100 - p}%`
  if (verb === 'bottom') return `bottom ${p}%`
  return `${verb} median (${p}th pct)`
}

function MissingProfileCard({ onEditProfile }) {
  return (
    <div className="panel">
      <div className="panel-header">How you compare in your area</div>
      <div style={{
        padding: '20px 18px',
        fontFamily: 'var(--font-sans)', fontSize: '0.78rem',
        color: 'var(--text-muted)', lineHeight: 1.6,
      }}>
        Add your specialty and state to see how your numbers stack up against
        similar practices in your area.
        {onEditProfile && (
          <div style={{ marginTop: '12px' }}>
            <button className="btn" onClick={onEditProfile}>
              Add practice profile
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
