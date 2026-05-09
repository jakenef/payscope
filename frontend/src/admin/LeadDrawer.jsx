import { useEffect, useState } from 'react'
import { LEAD_STATUSES } from './config'
import { listOutreach } from './api'

const EMPTY = {
  practice_name: '', contact_name: '', email: '', phone: '',
  specialty: '', state: '', status: 'new',
  source: '', notes: '', next_action_at: null,
}

export default function LeadDrawer({ mode, lead, onSave, onDelete, onClose, busy }) {
  const [draft, setDraft] = useState(lead || EMPTY)
  const [outreach, setOutreach] = useState([])

  useEffect(() => { setDraft(lead || EMPTY) }, [lead])

  useEffect(() => {
    if (mode === 'edit' && lead?.id) {
      listOutreach(lead.id).then(setOutreach).catch(() => setOutreach([]))
    }
  }, [mode, lead?.id])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const update = (field, value) => setDraft({ ...draft, [field]: value })

  const handleSave = (e) => {
    e.preventDefault()
    if (!draft.practice_name?.trim()) return
    const patch = { ...draft }
    // Only send dirty fields on edit; create needs all
    onSave(mode === 'create' ? patch : patch)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(5,14,18,0.78)', backdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel fade-up"
        style={{
          width: '460px', height: '100%',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <div className="panel-header">
          {mode === 'create' ? 'New lead' : draft.practice_name || 'Lead'}
          <span className="panel-tag">Esc to close</span>
        </div>

        <form onSubmit={handleSave} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Field label="Practice name" required>
            <input value={draft.practice_name || ''} onChange={(e) => update('practice_name', e.target.value)} required style={inputStyle} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="Contact name">
              <input value={draft.contact_name || ''} onChange={(e) => update('contact_name', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Status">
              <select value={draft.status || 'new'} onChange={(e) => update('status', e.target.value)} style={inputStyle}>
                {LEAD_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="Email">
              <input type="email" value={draft.email || ''} onChange={(e) => update('email', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Phone">
              <input type="tel" value={draft.phone || ''} onChange={(e) => update('phone', e.target.value)} placeholder="+1 555 555 5555" style={inputStyle} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="Specialty">
              <input value={draft.specialty || ''} onChange={(e) => update('specialty', e.target.value)} placeholder="ENT, Cardiology…" style={inputStyle} />
            </Field>
            <Field label="State">
              <input value={draft.state || ''} onChange={(e) => update('state', e.target.value.toUpperCase())} maxLength={2} placeholder="CA" style={inputStyle} />
            </Field>
          </div>
          <Field label="Source">
            <input value={draft.source || ''} onChange={(e) => update('source', e.target.value)} placeholder="NPI registry, referral, web…" style={inputStyle} />
          </Field>
          <Field label="Notes">
            <textarea value={draft.notes || ''} onChange={(e) => update('notes', e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-sans)' }} />
          </Field>

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button
              type="submit" disabled={busy}
              className="btn"
              style={{
                flex: 1, padding: '9px 14px',
                background: 'rgba(42,157,143,0.16)',
                borderColor: 'var(--primary)', color: 'var(--primary-light)',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? 'Saving…' : (mode === 'create' ? 'Create lead' : 'Save changes')}
            </button>
            {mode === 'edit' && (
              <button type="button" onClick={onDelete} disabled={busy} className="btn" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>
                Delete
              </button>
            )}
          </div>
        </form>

        {mode === 'edit' && (
          <div style={{ padding: '0 18px 18px' }}>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: '0.62rem',
              fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--primary-light)', marginBottom: '10px', marginTop: '6px',
            }}>
              Outreach history ({outreach.length})
            </div>
            {outreach.length === 0 ? (
              <div style={{
                padding: '14px', textAlign: 'center',
                border: '1px dashed var(--border-mid)',
                fontFamily: 'var(--font-sans)', fontSize: '0.74rem',
                color: 'var(--text-muted)',
              }}>
                No outreach yet. Email/call automation will populate this.
              </div>
            ) : (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {outreach.map((o) => (
                  <li key={o.id} style={{
                    padding: '8px 10px',
                    background: 'var(--bg-panel-alt)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontFamily: 'var(--font-sans)', fontSize: '0.7rem',
                    }}>
                      <span style={{
                        color: 'var(--primary-light)', fontWeight: 600,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}>
                        {o.channel} · {o.direction} · {o.outcome || 'pending'}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {new Date(o.occurred_at).toLocaleString()}
                      </span>
                    </div>
                    {o.subject && (
                      <div style={{
                        marginTop: '4px',
                        fontFamily: 'var(--font-sans)', fontSize: '0.78rem',
                        color: 'var(--text-bright)',
                      }}>{o.subject}</div>
                    )}
                    {o.body && (
                      <div style={{
                        marginTop: '4px',
                        fontFamily: 'var(--font-sans)', fontSize: '0.74rem',
                        color: 'var(--text)', whiteSpace: 'pre-wrap',
                      }}>{o.body}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{
        fontFamily: 'var(--font-sans)', fontSize: '0.6rem',
        fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--text-muted)', marginBottom: '4px',
      }}>
        {label}{required && <span style={{ color: 'var(--red)' }}> *</span>}
      </div>
      {children}
    </label>
  )
}

const inputStyle = {
  width: '100%',
  background: 'var(--bg-dark)',
  border: '1px solid var(--border)',
  color: 'var(--text-bright)',
  fontFamily: 'var(--font-sans)',
  fontSize: '0.82rem',
  padding: '7px 9px',
  outline: 'none',
}
