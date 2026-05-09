import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'

export default function UserMenu({ onSignInClick }) {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!user) {
    return (
      <button className="btn" onClick={onSignInClick}>
        Sign in
      </button>
    )
  }

  const initials = (user.name || user.email || '?')
    .split(/[ @.]/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('')

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'transparent',
          border: '1px solid var(--border-mid)',
          padding: '3px 10px 3px 3px',
          cursor: 'pointer',
          color: 'var(--text-bright)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span style={{
          width: '22px', height: '22px',
          background: 'var(--primary-dark)',
          color: 'rgba(255,255,255,0.92)',
          fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.04em',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{initials}</span>
        <span style={{ fontSize: '0.74rem' }}>{user.name}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem', marginLeft: '2px' }}>▾</span>
      </button>

      {open && (
        <div className="panel" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          minWidth: '220px', zIndex: 50,
        }}>
          <div style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: '0.78rem',
              color: 'var(--text-bright)', fontWeight: 500,
            }}>{user.name}</div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: '0.7rem',
              color: 'var(--text-muted)', marginTop: '2px',
            }}>{user.email}</div>
            <div style={{
              marginTop: '6px',
              fontFamily: 'var(--font-sans)', fontSize: '0.62rem',
              fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--primary-light)',
            }}>{user.plan}</div>
          </div>
          <button
            onClick={() => { setOpen(false); signOut() }}
            style={{
              width: '100%', textAlign: 'left',
              padding: '9px 12px', background: 'transparent', border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '0.76rem',
              color: 'var(--text)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(42,157,143,0.06)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
