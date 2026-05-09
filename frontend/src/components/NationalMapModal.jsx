import { useEffect, useMemo, useState } from 'react'
import { feature } from 'topojson-client'
import { geoPath, geoAlbersUsa } from 'd3-geo'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// FIPS state ID (from us-atlas TopoJSON) → USPS 2-letter code
const FIPS_TO_USPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT',
  '10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL',
  '18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
  '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE',
  '32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND',
  '39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY',
}

// Metric definitions for the legend toggle
const METRICS = [
  { key: 'biller_score',      label: 'Biller score',      higher: true,  unit: '' },
  { key: 'leakage_pct',       label: 'Revenue leakage',   higher: false, unit: '%' },
  { key: 'payment_ratio_pct', label: 'Collection Rate',   higher: true,  unit: '%' },
]

// Map a metric value to a color (interpolate red → amber → green based on rank)
function colorFor(value, allValues, higherIsBetter) {
  if (value == null) return '#1e3a44'
  const sorted = [...allValues].sort((a, b) => a - b)
  let rank = sorted.indexOf(value) / (sorted.length - 1) // 0..1
  if (!higherIsBetter) rank = 1 - rank
  // 3-stop: #e05252 (red) → #f0a050 (amber) → #52b788 (green)
  if (rank < 0.5) {
    const t = rank * 2
    return mix('#e05252', '#f0a050', t)
  } else {
    const t = (rank - 0.5) * 2
    return mix('#f0a050', '#52b788', t)
  }
}

function mix(a, b, t) {
  const h = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]
  const [ar, ag, ab] = h(a), [br, bg, bb] = h(b)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `rgb(${r},${g},${bl})`
}

export default function NationalMapModal({ open, onClose, specialty, userState }) {
  const [topology, setTopology] = useState(null)
  const [statesData, setStatesData] = useState(null)
  const [hovered, setHovered] = useState(null) // { code, x, y }
  const [metricKey, setMetricKey] = useState('biller_score')
  const [error, setError] = useState(null)

  // Load TopoJSON once
  useEffect(() => {
    if (!open || topology) return
    fetch('/us-states-10m.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Map file ${r.status}`)
        return r.json()
      })
      .then(setTopology)
      .catch((e) => setError('Failed to load map: ' + e.message))
  }, [open, topology])

  // Load benchmark data when modal opens or specialty changes
  useEffect(() => {
    if (!open) return
    const sp = specialty || 'Other'
    const url = `${API_URL}/api/benchmarks/by-state?specialty=${encodeURIComponent(sp)}`
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Backend ${r.status} from ${API_URL}`)
        const d = await r.json()
        if (!d || !d.states) throw new Error(`Backend returned no state data (got ${JSON.stringify(d).slice(0, 80)})`)
        return d
      })
      .then((d) => setStatesData(d.states))
      .catch((e) => setError(e.message))
  }, [open, specialty])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Build path generator + features
  const { features, pathFn } = useMemo(() => {
    if (!topology) return { features: [], pathFn: null }
    const fc = feature(topology, topology.objects.states)
    const projection = geoAlbersUsa().fitSize([900, 500], fc)
    return { features: fc.features, pathFn: geoPath(projection) }
  }, [topology])

  // Median values for the chosen metric, used to drive the color scale
  const medianByState = useMemo(() => {
    if (!statesData) return {}
    const out = {}
    for (const [code, d] of Object.entries(statesData)) {
      out[code] = d[metricKey][1] // [p25, median, p75]
    }
    return out
  }, [statesData, metricKey])

  const allMedians = useMemo(() => Object.values(medianByState), [medianByState])
  const activeMetric = METRICS.find((m) => m.key === metricKey)

  if (!open) return null

  const hoveredData = hovered && statesData?.[hovered.code]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(5, 14, 18, 0.82)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel fade-up"
        style={{
          width: '100%', maxWidth: '1040px',
          height: '94vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div className="panel-header">
          National benchmarks{specialty ? ` · ${specialty}` : ''}
          <span className="panel-tag">Hover a state · Esc to close</span>
        </div>

        {/* Metric toggle */}
        <div style={{
          display: 'flex', gap: '6px', padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetricKey(m.key)}
              className="btn"
              style={{
                background: metricKey === m.key ? 'rgba(42,157,143,0.16)' : 'transparent',
                borderColor: metricKey === m.key ? 'var(--primary)' : 'var(--border-mid)',
                color: metricKey === m.key ? 'var(--primary-light)' : 'var(--text-bright)',
                padding: '5px 12px',
                fontSize: '0.7rem',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Map area — fills remaining vertical space */}
        <div style={{
          position: 'relative',
          flex: 1, minHeight: 0,
          padding: '12px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {error && (
            <div style={{
              padding: '12px', background: 'var(--red-bg)',
              border: '1px solid var(--red)', color: 'var(--red)',
              fontFamily: 'var(--font-sans)', fontSize: '0.78rem',
              maxWidth: '500px',
            }}>{error}</div>
          )}
          {!error && (!topology || !statesData) && (
            <div style={{
              padding: '40px', textAlign: 'center',
              fontFamily: 'var(--font-sans)', fontSize: '0.78rem',
              color: 'var(--text-muted)',
            }}>
              Loading map<span className="blink-cursor" />
            </div>
          )}
          {!error && topology && statesData && (
            <svg
              viewBox="0 0 900 500"
              preserveAspectRatio="xMidYMid meet"
              style={{
                width: '100%', height: '100%',
                maxWidth: '100%', maxHeight: '100%',
                display: 'block',
              }}
              onMouseLeave={() => setHovered(null)}
            >
              {features.map((f) => {
                const code = FIPS_TO_USPS[String(f.id).padStart(2, '0')]
                if (!code) return null
                const median = medianByState[code]
                const fill = colorFor(median, allMedians, activeMetric.higher)
                const isUserState = userState && code === userState
                return (
                  <path
                    key={code}
                    d={pathFn(f)}
                    fill={fill}
                    stroke={isUserState ? '#d8edf0' : '#0d1f24'}
                    strokeWidth={isUserState ? 2 : 0.6}
                    style={{ cursor: 'pointer', transition: 'opacity 0.1s' }}
                    opacity={hovered && hovered.code !== code ? 0.55 : 1}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect()
                      setHovered({
                        code,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                      })
                    }}
                  />
                )
              })}
            </svg>
          )}

          {/* Floating tooltip */}
          {hovered && hoveredData && (
            <div style={{
              position: 'absolute',
              left: Math.min(hovered.x + 16, 700),
              top: hovered.y + 16,
              pointerEvents: 'none',
              background: 'var(--bg-panel-alt)',
              border: '1px solid var(--border-mid)',
              padding: '10px 12px',
              minWidth: '200px',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.74rem',
              color: 'var(--text)',
              boxShadow: '0 8px 24px -4px rgba(0,0,0,0.5)',
              zIndex: 2,
            }}>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: '1.1rem',
                color: 'var(--text-bright)', marginBottom: '4px',
              }}>
                {hovered.code}
              </div>
              <div style={{
                fontSize: '0.62rem', color: 'var(--text-muted)',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                marginBottom: '8px',
              }}>
                n={hoveredData.cohort_size} {specialty} practices
              </div>
              {METRICS.map((m) => {
                const [p25, median, p75] = hoveredData[m.key]
                const isActive = m.key === metricKey
                return (
                  <div key={m.key} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '3px 0',
                    borderBottom: '1px solid var(--text-dim)',
                    color: isActive ? 'var(--text-bright)' : 'var(--text)',
                  }}>
                    <span style={{ marginRight: '12px' }}>{m.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                      {fmt(p25, m.unit)} · <strong style={{ color: 'var(--primary-light)' }}>{fmt(median, m.unit)}</strong> · {fmt(p75, m.unit)}
                    </span>
                  </div>
                )
              })}
              <div style={{
                marginTop: '6px', fontSize: '0.6rem',
                color: 'var(--text-muted)', letterSpacing: '0.06em',
              }}>
                p25 · median · p75
              </div>
            </div>
          )}

        </div>

        {/* Legend — fixed row at the bottom of the panel */}
        {!error && topology && statesData && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 14px',
            borderTop: '1px solid var(--border)',
            fontFamily: 'var(--font-sans)', fontSize: '0.66rem',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}>
            <span style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {activeMetric.label} ({activeMetric.higher ? 'higher better' : 'lower better'})
            </span>
            <div style={{
              flex: 1, maxWidth: '260px', height: '8px',
              background: 'linear-gradient(to right, #e05252, #f0a050, #52b788)',
            }} />
            <span>worse</span>
            <span style={{ marginLeft: 'auto' }}>better</span>
            {userState && (
              <span style={{
                marginLeft: '12px',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                color: 'var(--text-bright)',
              }}>
                <span style={{
                  display: 'inline-block', width: '10px', height: '10px',
                  border: '2px solid #d8edf0', background: 'transparent',
                }} />
                Your state
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function fmt(v, unit) {
  if (v == null) return '—'
  const n = Number(v)
  return `${Number.isInteger(n) ? n : n.toFixed(1)}${unit || ''}`
}
