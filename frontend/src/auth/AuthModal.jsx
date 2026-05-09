import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

export default function AuthModal({ open, onClose, initialMode = 'signin' }) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [info, setInfo] = useState(null)

  useEffect(() => {
    if (open) {
      setMode(initialMode); setErr(null); setInfo(null); setBusy(false)
    }
  }, [open, initialMode])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(null); setInfo(null)
    try {
      if (mode === 'signup') {
        await signUp({ email, password, name })
        // If email confirmations are on, the session won't be set yet — tell the user.
        setInfo('Account created. Check your email for a confirmation link before signing in.')
      } else {
        await signIn({ email, password })
        onClose()
      }
    } catch (ex) {
      setErr(ex.message || 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  const isSignup = mode === 'signup'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(5, 14, 18, 0.78)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel fade-up"
        style={{ width: '100%', maxWidth: '420px' }}
      >
        <div className="panel-header">
          {isSignup ? 'Create your account' : 'Sign in to Payscope'}
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '22px 22px 20px' }}>
          {isSignup && (
            <Field label="Name">
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                autoComplete="name" placeholder="Dr. Jane Smith"
                style={inputStyle}
              />
            </Field>
          )}

          <Field label="Email">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" placeholder="you@practice.com" required
              style={inputStyle}
            />
          </Field>

          <Field label="Password">
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder="••••••••" required minLength={6}
              style={inputStyle}
            />
          </Field>

          {err && (
            <div style={{
              marginTop: '4px', marginBottom: '12px',
              padding: '8px 10px',
              background: 'var(--red-bg)', border: '1px solid var(--red)',
              fontFamily: 'var(--font-sans)', fontSize: '0.74rem',
              color: 'var(--red)',
            }}>{err}</div>
          )}

          {info && (
            <div style={{
              marginTop: '4px', marginBottom: '12px',
              padding: '8px 10px',
              background: 'var(--green-bg)', border: '1px solid var(--green)',
              fontFamily: 'var(--font-sans)', fontSize: '0.74rem',
              color: 'var(--green)',
            }}>{info}</div>
          )}

          <button
            type="submit" disabled={busy}
            className="btn"
            style={{
              width: '100%', padding: '10px 14px', marginTop: '6px',
              background: busy ? 'transparent' : 'rgba(42,157,143,0.14)',
              borderColor: 'var(--primary)',
              color: 'var(--primary-light)',
              opacity: busy ? 0.6 : 1,
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? 'Signing in…' : isSignup ? 'Create account' : 'Sign in'}
          </button>

          <div style={{
            marginTop: '16px', textAlign: 'center',
            fontFamily: 'var(--font-sans)', fontSize: '0.74rem',
            color: 'var(--text-muted)',
          }}>
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => setMode(isSignup ? 'signin' : 'signup')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--primary-light)', fontFamily: 'var(--font-sans)',
                fontSize: '0.74rem', textDecoration: 'underline', padding: 0,
              }}
            >
              {isSignup ? 'Sign in' : 'Create one'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
