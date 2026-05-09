import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { isAdminEmail, LEAD_STATUSES } from './config'
import { listLeads, createLead, updateLead, deleteLead } from './api'
import LeadDrawer from './LeadDrawer'

export default function AdminApp() {
  const { user, loading, signOut } = useAuth()
  const [leads, setLeads] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [openLead, setOpenLead] = useState(null)
  const [creating, setCreating] = useState(false)

  const refresh = async () => {
    setError(null)
    try {
      setLeads(await listLeads())
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    if (user && isAdminEmail(user.email)) refresh()
  }, [user?.id])

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

  const counts = LEAD_STATUSES.reduce((acc, s) => {
    acc[s.key] = leads.filter((l) => l.status === s.key).length
    return acc
  }, {})

  const handleCreate = async (lead) => {
    setBusy(true)
    try {
      await createLead(lead)
      await refresh()
      setCreating(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleUpdate = async (id, patch) => {
    setBusy(true)
    try {
      const updated = await updateLead(id, patch)
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)))
      if (openLead?.id === id) setOpenLead(updated)
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
      await deleteLead(id)
      setLeads((prev) => prev.filter((l) => l.id !== id))
      if (openLead?.id === id) setOpenLead(null)
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
        borderBottom: '1px solid var(--red)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '52px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <span style={{
            fontFamily: 'var(--font-serif)', fontSize: '1.35rem',
            color: 'var(--text-bright)',
          }}>
            Payscope
          </span>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: '0.65rem',
            fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--red)',
          }}>
            Admin · Internal
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
        maxWidth: '1480px', margin: '0 auto', width: '100%',
      }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: '20px',
        }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: '1.6rem',
              color: 'var(--text-bright)', fontWeight: 400,
            }}>
              Outreach pipeline
            </h1>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: '0.74rem',
              color: 'var(--text-muted)', marginTop: '4px',
            }}>
              {leads.length} leads total
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setCreating(true)} style={{ padding: '8px 18px' }}>
            + Add lead
          </button>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', marginBottom: '16px',
            background: 'var(--red-bg)', border: '1px solid var(--red)',
            fontFamily: 'var(--font-sans)', fontSize: '0.78rem', color: 'var(--red)',
          }}>{error}</div>
        )}

        {/* Pipeline columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${LEAD_STATUSES.length}, minmax(180px, 1fr))`,
          gap: '12px',
          alignItems: 'start',
          overflowX: 'auto',
        }}>
          {LEAD_STATUSES.map((s) => (
            <PipelineColumn
              key={s.key}
              status={s}
              leads={leads.filter((l) => l.status === s.key)}
              count={counts[s.key]}
              onClick={(l) => setOpenLead(l)}
              onChangeStatus={(id, status) => handleUpdate(id, { status })}
            />
          ))}
        </div>

        {leads.length === 0 && (
          <div style={{
            marginTop: '40px', textAlign: 'center',
            fontFamily: 'var(--font-sans)', fontSize: '0.8rem',
            color: 'var(--text-muted)',
          }}>
            No leads yet. Click "Add lead" to start the pipeline.
          </div>
        )}
      </main>

      {creating && (
        <LeadDrawer
          mode="create"
          onSave={handleCreate}
          onClose={() => setCreating(false)}
          busy={busy}
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
        />
      )}
    </div>
  )
}

function PipelineColumn({ status, leads, count, onClick, onChangeStatus }) {
  return (
    <div className="panel" style={{ minWidth: 0 }}>
      <div className="panel-header" style={{
        background: 'transparent',
        borderBottom: `2px solid ${status.color}`,
      }}>
        <span style={{ color: status.color }}>{status.label}</span>
        <span className="panel-tag">{count}</span>
      </div>
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '120px' }}>
        {leads.map((l) => (
          <div
            key={l.id}
            onClick={() => onClick(l)}
            style={{
              padding: '8px 10px',
              background: 'var(--bg-panel-alt)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: '0.78rem',
              fontWeight: 500, color: 'var(--text-bright)',
            }}>
              {l.practice_name}
            </div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: '0.66rem',
              color: 'var(--text-muted)', marginTop: '2px',
            }}>
              {l.contact_name || '—'}
              {l.specialty && ` · ${l.specialty}`}
              {l.state && ` · ${l.state}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
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
