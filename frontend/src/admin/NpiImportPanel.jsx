import { useState } from 'react'
import { NPI_TAXONOMY_PRESETS } from './config'
import { importFromNpiRegistry } from './api'

export default function NpiImportPanel({ onImported }) {
  const [state, setState] = useState('')
  const [taxonomy, setTaxonomy] = useState(NPI_TAXONOMY_PRESETS[0]?.value ?? '207Y00000X')
  const [limit, setLimit] = useState(100)
  const [skip, setSkip] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const run = async (e) => {
    e.preventDefault()
    const st = state.trim().toUpperCase()
    if (st.length !== 2) {
      setMsg({ type: 'err', text: 'State must be a 2-letter code (e.g. CA).' })
      return
    }
    const tax = taxonomy.trim()
    if (tax.length < 3) {
      setMsg({ type: 'err', text: 'Enter a NUCC taxonomy code.' })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const res = await importFromNpiRegistry({
        state: st,
        taxonomyCode: tax,
        limit: Math.min(200, Math.max(1, Number(limit) || 100)),
        skip: Math.max(0, Number(skip) || 0),
      })
      setMsg({
        type: 'ok',
        text: `Upserted ${res.upserted} practice(s). NPPES reported ${res.result_count ?? '—'} total matches for this query.`,
      })
      onImported?.()
    } catch (err) {
      setMsg({ type: 'err', text: err.message || String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel" style={{ marginBottom: '20px' }}>
      <div className="panel-header" style={{ borderBottom: '1px solid var(--border-mid)' }}>
        <span>Import from NPI Registry</span>
        <span className="panel-tag">CMS NPPES · NPI-2</span>
      </div>
      <form onSubmit={run} style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5,
        }}>
          Pull organizational providers by state + NUCC taxonomy. Rows merge on <code style={{ color: 'var(--primary-light)' }}>npi</code>
          {' '}via the API (service role). Configure backend env vars in <code style={{ color: 'var(--primary-light)' }}>backend/.env</code>.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              State
            </span>
            <input
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="CA"
              style={fld}
              autoComplete="off"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Taxonomy
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={NPI_TAXONOMY_PRESETS.some((p) => p.value === taxonomy) ? taxonomy : '_custom'}
                onChange={(e) => {
                  const v = e.target.value
                  if (v !== '_custom') setTaxonomy(v)
                }}
                style={{ ...fld, flex: '0 1 200px', minWidth: 0 }}
              >
                {NPI_TAXONOMY_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
                <option value="_custom">Custom code…</option>
              </select>
              <input
                value={taxonomy}
                onChange={(e) => setTaxonomy(e.target.value.trim())}
                placeholder="207Y00000X"
                style={{ ...fld, flex: '1 1 140px', minWidth: 0 }}
              />
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Limit
            </span>
            <input type="number" min={1} max={200} value={limit} onChange={(e) => setLimit(e.target.value)} style={fld} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Skip (pagination)
            <input type="number" min={0} value={skip} onChange={(e) => setSkip(e.target.value)} style={{ ...fld, width: '88px' }} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ padding: '8px 16px', marginLeft: 'auto' }}>
            {busy ? 'Importing…' : 'Run import'}
          </button>
        </div>
        {msg && (
          <div style={{
            padding: '8px 10px',
            border: `1px solid ${msg.type === 'ok' ? 'var(--primary)' : 'var(--red)'}`,
            background: msg.type === 'ok' ? 'rgba(42,157,143,0.08)' : 'var(--red-bg)',
            color: msg.type === 'ok' ? 'var(--primary-light)' : 'var(--red)',
            fontFamily: 'var(--font-sans)', fontSize: '0.74rem',
          }}>
            {msg.text}
          </div>
        )}
      </form>
    </div>
  )
}

const fld = {
  background: 'var(--bg-dark)',
  border: '1px solid var(--border)',
  color: 'var(--text-bright)',
  fontFamily: 'var(--font-sans)',
  fontSize: '0.82rem',
  padding: '7px 9px',
  outline: 'none',
}
