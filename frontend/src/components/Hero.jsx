import DashboardPreview from './DashboardPreview'

export default function Hero({ onPrimaryCta, onSecondaryCta }) {
  return (
    <section style={{
      paddingTop: '40px',
      paddingBottom: '8px',
      width: '100%',
      maxWidth: '1240px',
      margin: '0 auto',
      textAlign: 'center',
    }}>
      {/* eyebrow */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '4px 12px',
        border: '1px solid var(--border-mid)',
        background: 'rgba(42,157,143,0.06)',
        marginBottom: '24px',
      }}>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'var(--primary)', display: 'inline-block',
        }} />
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: '0.62rem',
          fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--primary-light)',
        }}>
          Revenue integrity for independent practices
        </span>
      </div>

      {/* headline */}
      <h1 style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 'clamp(2.4rem, 5vw, 3.6rem)',
        color: 'var(--text-bright)',
        lineHeight: 1.08,
        letterSpacing: '-0.01em',
        marginBottom: '22px',
        fontWeight: 400,
      }}>
        Stop leaving money<br />on the exam table.
      </h1>

      {/* subhead */}
      <p style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '1.05rem',
        lineHeight: 1.55,
        color: 'var(--text)',
        maxWidth: '640px',
        margin: '0 auto 32px',
      }}>
        Payscope analyzes your claims data, surfaces underpayments and downcoding in seconds,
        and gives you the receipts to confront your billing company —
        or your payer mix — with hard numbers.
      </p>

      {/* CTAs */}
      <div style={{
        display: 'flex', gap: '12px', justifyContent: 'center',
        flexWrap: 'wrap', marginBottom: '14px',
      }}>
        <button
          className="btn btn-primary"
          onClick={onPrimaryCta}
          style={{ padding: '10px 22px', fontSize: '0.78rem' }}
        >
          Get started — free
        </button>
        <button
          className="btn"
          onClick={onSecondaryCta}
          style={{ padding: '10px 22px', fontSize: '0.78rem' }}
        >
          Sign in
        </button>
      </div>

      <div style={{
        fontFamily: 'var(--font-sans)', fontSize: '0.7rem',
        color: 'var(--text-muted)',
      }}>
        No credit card · No EHR integration · Your data is processed in-memory
      </div>

      {/* live dashboard preview with mock data */}
      <div className="hero-screenshot-frame">
        <DashboardPreview />
      </div>
    </section>
  )
}
