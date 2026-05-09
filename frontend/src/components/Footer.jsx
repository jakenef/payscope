const CONTACT_EMAIL = 'hello@payscope.scalr.media'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-panel)',
      padding: '20px 24px',
      marginTop: '40px',
    }}>
      <div style={{
        maxWidth: '1480px', margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{
            fontFamily: 'var(--font-serif)', fontSize: '1rem',
            color: 'var(--text-bright)',
          }}>
            Payscope
          </span>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: '0.7rem',
            color: 'var(--text-muted)',
          }}>
            © {year} · Revenue integrity for independent practices
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '20px',
          fontFamily: 'var(--font-sans)', fontSize: '0.75rem',
        }}>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Payscope%20inquiry`}
            style={{ color: 'var(--primary-light)', textDecoration: 'none' }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            Contact us
          </a>
          <span style={{ color: 'var(--text-muted)' }}>{CONTACT_EMAIL}</span>
        </div>
      </div>
    </footer>
  )
}
