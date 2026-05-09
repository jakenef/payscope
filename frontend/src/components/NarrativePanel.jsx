export default function NarrativePanel({ narrative }) {
  if (!narrative) return null

  return (
    <div className="panel">
      <div className="panel-header">
        AI Analysis
        <span className="panel-tag">GPT-4o</span>
      </div>
      <div style={{ padding: '16px' }}>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '0.83rem',
          color: 'var(--text)',
          lineHeight: 1.75,
          whiteSpace: 'pre-wrap',
        }}>
          {narrative}
        </p>
      </div>
    </div>
  )
}
