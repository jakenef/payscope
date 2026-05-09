import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { fetchBenchmarkOptions } from '../api/analyze'

export default function ProfileSettingsModal({ open, onClose }) {
  const { user, updateProfile, updateEmail, updatePassword } = useAuth()

  if (!open || !user) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(5, 14, 18, 0.78)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel fade-up"
        style={{ width: '100%', maxWidth: '480px', maxHeight: '94vh', overflowY: 'auto' }}
      >
        <Header onClose={onClose} />
        <div style={{ padding: '8px 22px 22px' }}>
          <ProfileSection user={user} updateProfile={updateProfile} />
          <Divider />
          <EmailSection user={user} updateEmail={updateEmail} />
          <Divider />
          <PasswordSection updatePassword={updatePassword} />
        </div>
      </div>
    </div>
  )
}

function Header({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="panel-header">
      Profile settings
      <span className="panel-tag">Esc to close</span>
    </div>
  )
}

function Divider() {
  return <hr className="section-rule" style={{ margin: '20px 0' }} />
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--font-sans)', fontSize: '0.62rem',
      fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--primary-light)', marginBottom: '12px',
    }}>{children}</div>
  )
}

function ProfileSection({ user, updateProfile }) {
  const [name, setName] = useState(user.name || '')
  const [specialty, setSpecialty] = useState(user.specialty || '')
  const [state, setState] = useState(user.state || '')
  const [options, setOptions] = useState({ specialties: [], states: [] })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    fetchBenchmarkOptions().then(setOptions).catch(() => {})
  }, [])

  const dirty = name !== (user.name || '') || specialty !== (user.specialty || '') || state !== (user.state || '')

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      await updateProfile({ name, specialty, state })
      setMsg({ type: 'ok', text: 'Profile saved.' })
    } catch (ex) {
      setMsg({ type: 'err', text: ex.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save}>
      <SectionTitle>Profile</SectionTitle>
      <Field label="Name">
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          autoComplete="name" style={inputStyle}
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Field label="Specialty">
          <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} style={inputStyle}>
            <option value="">Select…</option>
            {options.specialties.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="State">
          <select value={state} onChange={(e) => setState(e.target.value)} style={inputStyle}>
            <option value="">Select…</option>
            {options.states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Inline msg={msg} />
      <SaveButton busy={busy} disabled={!dirty}>Save profile</SaveButton>
    </form>
  )
}

function EmailSection({ user, updateEmail }) {
  const [email, setEmail] = useState(user.email || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const dirty = email && email !== user.email

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      await updateEmail(email)
      setMsg({ type: 'ok', text: 'Confirmation sent to both old and new addresses. Click both links to complete the change.' })
    } catch (ex) {
      setMsg({ type: 'err', text: ex.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save}>
      <SectionTitle>Change email</SectionTitle>
      <Field label="New email">
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="email" required style={inputStyle}
        />
      </Field>
      <Inline msg={msg} />
      <SaveButton busy={busy} disabled={!dirty}>Update email</SaveButton>
    </form>
  )
}

function PasswordSection({ updatePassword }) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const mismatch = pw && confirm && pw !== confirm

  const save = async (e) => {
    e.preventDefault()
    if (mismatch) { setMsg({ type: 'err', text: 'Passwords do not match' }); return }
    setBusy(true); setMsg(null)
    try {
      await updatePassword(pw)
      setMsg({ type: 'ok', text: 'Password updated.' })
      setPw(''); setConfirm('')
    } catch (ex) {
      setMsg({ type: 'err', text: ex.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save}>
      <SectionTitle>Change password</SectionTitle>
      <Field label="New password">
        <input
          type="password" value={pw} onChange={(e) => setPw(e.target.value)}
          autoComplete="new-password" minLength={6} required style={inputStyle}
        />
      </Field>
      <Field label="Confirm new password">
        <input
          type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password" minLength={6} required
          style={{
            ...inputStyle,
            borderColor: mismatch ? 'var(--red)' : 'var(--border)',
          }}
        />
      </Field>
      <Inline msg={msg} />
      <SaveButton busy={busy} disabled={!pw || !confirm || mismatch}>Update password</SaveButton>
    </form>
  )
}

function Inline({ msg }) {
  if (!msg) return null
  const isOk = msg.type === 'ok'
  return (
    <div style={{
      marginTop: '4px', marginBottom: '12px',
      padding: '8px 10px',
      background: isOk ? 'var(--green-bg)' : 'var(--red-bg)',
      border: `1px solid ${isOk ? 'var(--green)' : 'var(--red)'}`,
      fontFamily: 'var(--font-sans)', fontSize: '0.74rem',
      color: isOk ? 'var(--green)' : 'var(--red)',
      lineHeight: 1.5,
    }}>{msg.text}</div>
  )
}

function SaveButton({ busy, disabled, children }) {
  return (
    <button
      type="submit" disabled={busy || disabled}
      className="btn"
      style={{
        width: '100%', padding: '9px 14px', marginTop: '4px',
        background: (busy || disabled) ? 'transparent' : 'rgba(42,157,143,0.14)',
        borderColor: (busy || disabled) ? 'var(--border-mid)' : 'var(--primary)',
        color: (busy || disabled) ? 'var(--text-muted)' : 'var(--primary-light)',
        cursor: (busy || disabled) ? 'not-allowed' : 'pointer',
      }}
    >
      {busy ? 'Saving…' : children}
    </button>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: '14px' }}>
      <div style={{
        fontFamily: 'var(--font-sans)', fontSize: '0.62rem',
        fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--text-muted)', marginBottom: '5px',
      }}>{label}</div>
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
  fontSize: '0.85rem',
  padding: '8px 10px',
  outline: 'none',
}
