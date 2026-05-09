export default function ColumnMappingPill({ mapping, aiInferred }) {
  if (!mapping || !aiInferred) return null

  const entries = Object.entries(mapping)

  return (
    <div className="panel" style={{ borderColor: 'var(--amber)' }}>
      <div className="panel-header" style={{
        background: 'var(--amber-bg)',
        borderBottomColor: 'var(--amber)',
      }}>
        <span style={{ color: 'var(--amber)' }}>AI-detected columns</span>
        <span className="panel-tag">headers didn't match canonical schema</span>
      </div>
      <div style={{
        padding: '10px 12px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
      }}>
        {entries.map(([canonical, raw]) => (
          <span
            key={canonical}
            style={{
              background: 'var(--bg-panel-alt)',
              border: '1px solid var(--border)',
              padding: '3px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>{raw}</span>
            <span style={{ color: 'var(--text-dim)', margin: '0 6px' }}>→</span>
            <span style={{ color: 'var(--amber)', fontWeight: 500 }}>{canonical}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
