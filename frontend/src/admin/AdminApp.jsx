import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { isAdminEmail, LEAD_STATUSES } from './config'
import { listLeads, createLead, updateLead, deleteLead } from './api'
import LeadDrawer from './LeadDrawer'
import NpiImportPanel from './NpiImportPanel'
import VoiceOutreachBar from './VoiceOutreachBar'
import {
  cloneMockLeads,
  cloneMockOutreachMap,
  isAdminMockMode,
} from './mockData'

const US_STATES_FILTER = ['all', 'CA', 'WA', 'TX', 'FL', 'CO', 'MN', 'DC', 'UT']

export default function AdminApp() {
  const mockMode = isAdminMockMode()
  const { user, loading, signOut } = useAuth()
  const [leads, setLeads] = useState([])
  const [mockOutreach, setMockOutreach] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [openLead, setOpenLead] = useState(null)
  const [creating, setCreating] = useState(false)
  const [view, setView] = useState('pipeline')
  const [search, setSearch] = useState('')
  const [practiceFilter, setPracticeFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')

  const refreshLive = async () => {
    setError(null)
    try {
      setLeads(await listLeads())
    } catch (e) {
      setError(e.message)
    }
  }

  const refreshMock = () => {
    setLeads(cloneMockLeads())
    setMockOutreach(cloneMockOutreachMap())
  }

  const refresh = async () => {
    if (mockMode) {
      refreshMock()
      return
    }
    await refreshLive()
  }

  useEffect(() => {
    if (!user || !isAdminEmail(user.email)) return
    if (mockMode) {
      refreshMock()
    } else {
      refreshLive()
    }
  }, [user?.id, mockMode])

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter((l) => {
      if (q) {
        const blob = `${l.practice_name} ${l.contact_name || ''} ${l.npi || ''} ${l.city || ''}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      if (stateFilter !== 'all' && l.state !== stateFilter) return false
      if (practiceFilter === 'ent') {
        const s = String(l.specialty || '').toLowerCase()
        if (!s.includes('otolaryngology') && !s.includes('ent')) return false
      }
      if (practiceFilter === 'dental') {
        const s = String(l.specialty || '').toLowerCase()
        if (!s.includes('dent')) return false
      }
      return true
    })
  }, [leads, search, stateFilter, practiceFilter])

  const kpis = useMemo(() => computeKpis(leads), [leads])
  const counts = useMemo(() => {
    const c = {}
    for (const s of LEAD_STATUSES) {
      c[s.key] = filteredLeads.filter((l) => l.status === s.key).length
    }
    return c
  }, [filteredLeads])

  if (loading) {
    return <CenteredText>Loading…</CenteredText>
  }

  if (!user) {
    return (
      <CenteredText>
        You must <a href="/" style={{ color: 'var(--primary-light)' }}>sign in</a> to access this page.
      </CenteredText>
    )
  }

  if (!isAdminEmail(user.email)) {
    return (
      <CenteredText>
        Access denied — this area is for Payscope developers only.
        <div style={{ marginTop: '12px' }}>
          <a href="/" style={{ color: 'var(--primary-light)' }}>← Back to Payscope</a>
        </div>
      </CenteredText>
    )
  }

  const handleCreate = async (lead) => {
    setBusy(true)
    try {
      if (mockMode) {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        const row = {
          ...lead,
          id,
          created_at: now,
          updated_at: now,
        }
        setLeads((prev) => [row, ...prev])
        setMockOutreach((prev) => ({ ...prev, [id]: [] }))
        setCreating(false)
      } else {
        await createLead(lead)
        await refreshLive()
        setCreating(false)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleUpdate = async (id, patch) => {
    setBusy(true)
    try {
      if (mockMode) {
        const ts = new Date().toISOString()
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch, updated_at: ts } : l)))
        setOpenLead((cur) => (cur?.id === id ? { ...cur, ...patch, updated_at: ts } : cur))
      } else {
        const updated = await updateLead(id, patch)
        setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)))
        if (openLead?.id === id) setOpenLead(updated)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this lead?')) return
    setBusy(true)
    try {
      if (mockMode) {
        setLeads((prev) => prev.filter((l) => l.id !== id))
        setMockOutreach((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        if (openLead?.id === id) setOpenLead(null)
      } else {
        await deleteLead(id)
        setLeads((prev) => prev.filter((l) => l.id !== id))
        if (openLead?.id === id) setOpenLead(null)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--bg-panel)',
        borderBottom: `1px solid ${mockMode ? 'var(--primary)' : 'var(--red)'}`,
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        minHeight: '52px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--font-serif)', fontSize: '1.35rem',
            color: 'var(--text-bright)',
          }}>
            Payscope
          </span>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: '0.65rem',
            fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: mockMode ? 'var(--primary-light)' : 'var(--red)',
          }}>
            {mockMode ? 'Admin · Preview data' : 'Admin · Internal'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: '0.7rem',
            color: 'var(--text-muted)',
          }}>{user.email}</span>
          <a href="/" className="btn">← App</a>
          <button className="btn" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <main style={{
        flex: 1, padding: '24px',
        maxWidth: '1600px', margin: '0 auto', width: '100%',
      }}>
        {mockMode && (
          <div style={{
            marginBottom: '20px',
            padding: '12px 16px',
            border: '1px solid var(--primary)',
            background: 'rgba(42,157,143,0.08)',
            fontFamily: 'var(--font-sans)', fontSize: '0.78rem',
            color: 'var(--text)',
            lineHeight: 1.5,
          }}>
            <strong style={{ color: 'var(--primary-light)' }}>Preview dataset</strong>
            {' '}— Showing faux ENT and dental practices, Lob/voice fields, and outreach events. Live NPI import, Lob, and Twilio controls are hidden.
            For real leads: set{' '}
            <code style={{ fontSize: '0.72rem', color: 'var(--text-bright)' }}>VITE_ADMIN_USE_MOCK_DATA=false</code>
            {' '}in env (e.g. Vercel) and redeploy, or in <code style={{ fontSize: '0.72rem' }}>.env.local</code> for local dev.
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: '16px', flexWrap: 'wrap', marginBottom: '20px',
        }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.4rem, 2.5vw, 1.85rem)',
              color: 'var(--text-bright)', fontWeight: 400,
            }}>
              Outreach command center
            </h1>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: '0.74rem',
              color: 'var(--text-muted)', marginTop: '6px',
            }}>
              {filteredLeads.length} shown · {leads.length} total in workspace
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <ViewToggle value={view} onChange={setView} />
            <button className="btn btn-primary" onClick={() => setCreating(true)} style={{ padding: '8px 18px' }}>
              + Add lead
            </button>
          </div>
        </div>

        <KpiRow kpis={kpis} />

        <div className="panel" style={{ marginBottom: '20px', padding: '14px 16px' }}>
          <div style={{
            fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--text-muted)', marginBottom: '10px',
          }}>
            Filters
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '10px', alignItems: 'end',
          }}>
            <label style={filterLabel}>
              Search
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Practice, NPI, city…"
                style={filterInput}
              />
            </label>
            <label style={filterLabel}>
              Specialty
              <select
                value={practiceFilter}
                onChange={(e) => setPracticeFilter(e.target.value)}
                style={filterInput}
              >
                <option value="all">All</option>
                <option value="ent">ENT / Otolaryngology</option>
                <option value="dental">Dentistry</option>
              </select>
            </label>
            <label style={filterLabel}>
              State
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                style={filterInput}
              >
                {US_STATES_FILTER.map((s) => (
                  <option key={s} value={s}>{s === 'all' ? 'All states' : s}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', marginBottom: '16px',
            background: 'var(--red-bg)', border: '1px solid var(--red)',
            fontFamily: 'var(--font-sans)', fontSize: '0.78rem', color: 'var(--red)',
          }}>{error}</div>
        )}

        {!mockMode && (
          <>
            <NpiImportPanel onImported={refresh} />
            <VoiceOutreachBar onDone={refresh} />
          </>
        )}

        {mockMode && (
          <div className="panel" style={{ marginBottom: '20px', padding: '14px 16px', opacity: 0.92 }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Live integrations
            </div>
            <p style={{
              margin: '8px 0 0',
              fontFamily: 'var(--font-sans)', fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.55,
            }}>
              NPI registry import, Lob letter queue, and voice tick are wired to the real API. They stay hidden while preview data is on so you can focus on layout and copy.
            </p>
          </div>
        )}

        {view === 'pipeline' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${LEAD_STATUSES.length}, minmax(168px, 1fr))`,
            gap: '12px',
            alignItems: 'start',
            overflowX: 'auto',
            paddingBottom: '8px',
          }}>
            {LEAD_STATUSES.map((s) => (
              <PipelineColumn
                key={s.key}
                status={s}
                leads={filteredLeads.filter((l) => l.status === s.key)}
                count={counts[s.key]}
                onClick={(l) => setOpenLead(l)}
              />
            ))}
          </div>
        ) : (
          <LeadsTable leads={filteredLeads} onOpen={(l) => setOpenLead(l)} />
        )}

        {filteredLeads.length === 0 && (
          <div style={{
            marginTop: '40px', textAlign: 'center',
            fontFamily: 'var(--font-sans)', fontSize: '0.8rem',
            color: 'var(--text-muted)',
          }}>
            No leads match filters. Clear filters or add a lead.
          </div>
        )}
      </main>

      {creating && (
        <LeadDrawer
          mode="create"
          onSave={handleCreate}
          onClose={() => setCreating(false)}
          busy={busy}
          previewMode={mockMode}
        />
      )}
      {openLead && (
        <LeadDrawer
          mode="edit"
          lead={openLead}
          onSave={(patch) => handleUpdate(openLead.id, patch)}
          onDelete={() => handleDelete(openLead.id)}
          onClose={() => setOpenLead(null)}
          busy={busy}
          previewMode={mockMode}
          previewOutreach={mockMode ? (mockOutreach[openLead.id] ?? []) : undefined}
          onRefreshLead={async () => {
            if (mockMode) {
              const u = leads.find((l) => l.id === openLead.id)
              if (u) setOpenLead(u)
              return
            }
            try {
              const all = await listLeads()
              const u = all.find((l) => l.id === openLead.id)
              if (u) setOpenLead(u)
            } catch { /* ignore */ }
          }}
        />
      )}
    </div>
  )
}

function computeKpis(leads) {
  const now = Date.now()
  let voiceDue = 0
  let lettersActive = 0
  let dnc = 0
  let demos = 0
  for (const l of leads) {
    if (l.do_not_call) dnc++
    if (['demo_scheduled', 'demo_complete'].includes(l.status)) demos++
    const st = l.letter_status
    if (st && ['rendered', 'in_transit', 'mailed', 'delivered', 'submitted'].includes(String(st))) {
      lettersActive++
    }
    if (l.voice_followup_after && !l.last_voice_call_at && !l.do_not_call && l.phone) {
      const t = Date.parse(l.voice_followup_after)
      if (!Number.isNaN(t) && t <= now) voiceDue++
    }
  }
  const won = leads.filter((l) => l.status === 'won').length
  return {
    total: leads.length,
    voiceDue,
    lettersActive,
    dnc,
    demos,
    won,
  }
}

function KpiRow({ kpis }) {
  const items = [
    { label: 'In pipeline', value: kpis.total, hint: 'all stages' },
    { label: 'Mail in flight', value: kpis.lettersActive, hint: 'Lob lifecycle' },
    { label: 'Voice due', value: kpis.voiceDue, hint: 'ready to dial' },
    { label: 'Demos', value: kpis.demos, hint: 'booked + done' },
    { label: 'Won', value: kpis.won, hint: 'closed' },
    { label: 'DNC', value: kpis.dnc, hint: 'do not call' },
  ]
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: '10px',
      marginBottom: '20px',
    }}>
      {items.map((item) => (
        <div
          key={item.label}
          className="panel"
          style={{
            padding: '12px 14px',
            borderLeft: '3px solid var(--primary)',
          }}
        >
          <div style={{
            fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}>{item.label}</div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: '1.65rem', color: 'var(--text-bright)', marginTop: '4px', lineHeight: 1.1,
          }}>{item.value}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>{item.hint}</div>
        </div>
      ))}
    </div>
  )
}

function ViewToggle({ value, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', border: '1px solid var(--border)', borderRadius: '2px', overflow: 'hidden',
    }}>
      {[
        { id: 'pipeline', label: 'Board' },
        { id: 'table', label: 'Table' },
      ].map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onChange(v.id)}
          style={{
            padding: '7px 14px', fontSize: '0.72rem', fontFamily: 'var(--font-sans)',
            border: 'none', cursor: 'pointer',
            background: value === v.id ? 'rgba(42,157,143,0.2)' : 'var(--bg-panel-alt)',
            color: value === v.id ? 'var(--primary-light)' : 'var(--text-muted)',
          }}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}

function PipelineColumn({ status, leads, count, onClick }) {
  return (
    <div className="panel" style={{ minWidth: 0 }}>
      <div className="panel-header" style={{
        background: 'transparent',
        borderBottom: `2px solid ${status.color}`,
      }}>
        <span style={{ color: status.color }}>{status.label}</span>
        <span className="panel-tag">{count}</span>
      </div>
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '140px' }}>
        {leads.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onClick(l)}
            style={{
              textAlign: 'left',
              padding: '10px 11px',
              background: 'var(--bg-panel-alt)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
              borderRadius: '2px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: '0.8rem',
              fontWeight: 600, color: 'var(--text-bright)', lineHeight: 1.25,
            }}>
              {l.practice_name}
            </div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: '0.64rem',
              color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.35,
            }}>
              {l.npi && <span style={{ color: 'var(--primary-light)' }}>NPI {l.npi}</span>}
              {l.specialty && ` · ${l.specialty.split('—')[0].trim()}`}
              {l.state && ` · ${l.state}`}
            </div>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px',
            }}>
              {l.letter_status && (
                <span style={pillStyle('#4a8898')}>{l.letter_status}</span>
              )}
              {l.voice_call_outcome && (
                <span style={pillStyle('var(--amber)')}>{String(l.voice_call_outcome).slice(0, 22)}</span>
              )}
              {l.do_not_call && (
                <span style={pillStyle('var(--red)')}>DNC</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function pillStyle(color) {
  return {
    fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
    padding: '2px 6px', borderRadius: '2px',
    border: `1px solid ${color}`,
    color,
    background: `${color}14`,
  }
}

function LeadsTable({ leads, onOpen }) {
  const label = (s) => LEAD_STATUSES.find((x) => x.key === s)?.label || s
  return (
    <div className="panel" style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ width: '100%', minWidth: '720px' }}>
        <thead>
          <tr>
            <th>Practice</th>
            <th>State</th>
            <th>Specialty</th>
            <th>Stage</th>
            <th>Letter</th>
            <th>Voice</th>
            <th>NPI</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} onClick={() => onOpen(l)} style={{ cursor: 'pointer' }}>
              <td style={{ fontWeight: 500, color: 'var(--text-bright)' }}>{l.practice_name}</td>
              <td>{l.state || '—'}</td>
              <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.specialty || '—'}
              </td>
              <td>{label(l.status)}</td>
              <td>{l.letter_status || '—'}</td>
              <td style={{ fontSize: '0.8rem' }}>
                {l.last_voice_call_at ? (
                  <span title={l.voice_call_outcome || ''}>Called</span>
                ) : l.voice_followup_after ? (
                  <span style={{ color: 'var(--amber)' }}>Queued</span>
                ) : (
                  '—'
                )}
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{l.npi || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const filterLabel = { display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const filterInput = {
  width: '100%',
  background: 'var(--bg-dark)',
  border: '1px solid var(--border)',
  color: 'var(--text-bright)',
  fontFamily: 'var(--font-sans)',
  fontSize: '0.82rem',
  padding: '8px 10px',
  outline: 'none',
}

function CenteredText({ children }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px',
      fontFamily: 'var(--font-sans)', fontSize: '0.9rem',
      color: 'var(--text)',
      textAlign: 'center',
    }}>
      <div>{children}</div>
    </div>
  )
}
