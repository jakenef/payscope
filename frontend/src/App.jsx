import { useState } from 'react'
import { analyzeCSV } from './api/analyze'
import UploadZone from './components/UploadZone'
import ScoreSidebar from './components/ScoreSidebar'
import UnderpaymentTable from './components/UnderpaymentTable'
import PayerChart from './components/PayerChart'
import NarrativePanel from './components/NarrativePanel'
import ChatPanel from './components/ChatPanel'
import ColumnMappingPill from './components/ColumnMappingPill'
import LandingContent from './components/LandingContent'

export default function App() {
  const [status, setStatus] = useState('idle')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const handleUpload = async (file) => {
    setStatus('loading')
    setError(null)
    try {
      const result = await analyzeCSV(file)
      setData(result)
      setStatus('done')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  const handleBack = () => {
    setStatus('idle')
    setData(null)
    setError(null)
  }

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* ── Header ──────────────────────────────── */}
      <header style={{
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '52px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.35rem',
            color: 'var(--text-bright)',
            letterSpacing: '0.01em',
          }}>
            Payscope
          </span>
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.65rem',
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--primary)',
          }}>
            Revenue Integrity
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {(status === 'done' || status === 'error') && (
            <button className="btn" onClick={handleBack}>
              ← New Analysis
            </button>
          )}
          <StatusBadge status={status} />
        </div>
      </header>

      {/* ── Main ────────────────────────────────── */}
      <main style={{ maxWidth: '1480px', margin: '0 auto', padding: '28px 24px 48px' }}>

        {/* Upload / idle */}
        {(status === 'idle' || status === 'error') && (
          <div className="fade-up" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            paddingTop: '56px',
          }}>
            <div className="panel" style={{ width: '100%', maxWidth: '520px' }}>
              <div className="panel-header">
                Claims Analysis
                <span className="panel-tag">Upload to begin</span>
              </div>
              <div style={{ padding: '28px 24px 24px' }}>
                <div style={{ marginBottom: '20px' }}>
                  <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: '0.8rem',
                    color: 'var(--text-muted)', lineHeight: 1.6,
                  }}>
                    Upload a CSV or Excel file of submitted claims. Columns are auto-detected,
                    and underpayments and downcoding are evaluated against CMS Medicare benchmark rates.
                  </p>
                </div>
                <UploadZone onUpload={handleUpload} />
              </div>
            </div>

            {status === 'error' && (
              <div style={{
                width: '100%', maxWidth: '520px', marginTop: '10px',
                padding: '10px 14px',
                background: 'var(--red-bg)',
                border: '1px solid var(--red)',
                fontFamily: 'var(--font-sans)', fontSize: '0.78rem',
                color: 'var(--red)',
              }}>
                {error}
              </div>
            )}

            <div style={{
              marginTop: '20px', display: 'flex', gap: '12px',
              fontFamily: 'var(--font-sans)', fontSize: '0.62rem',
              fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}>
              <span>CMS Medicare Rates 2024</span>
              <span>·</span>
              <span>GPT-4o Analysis</span>
              <span>·</span>
              <span>No data retained</span>
            </div>

            <LandingContent />
          </div>
        )}

        {/* Loading */}
        {status === 'loading' && (
          <div className="fade-up" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minHeight: 'calc(100vh - 160px)', gap: '16px',
          }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: '1.5rem',
              color: 'var(--text-bright)', letterSpacing: '0.01em',
            }}>
              Analyzing claims data
              <span className="blink-cursor" />
            </div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: '0.72rem',
              color: 'var(--text-muted)', letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              Comparing against CMS Medicare benchmark rates
            </div>
          </div>
        )}

        {/* Dashboard */}
        {status === 'done' && data && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {data.column_mapping_ai_inferred && (
              <ColumnMappingPill
                mapping={data.column_mapping}
                aiInferred={data.column_mapping_ai_inferred}
              />
            )}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              <ScoreSidebar summary={data.summary} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {data.ai_narrative && <NarrativePanel narrative={data.ai_narrative} />}
                {data.underpayment_table.length > 0 ? (
                  <UnderpaymentTable rows={data.underpayment_table} />
                ) : (
                  <div className="panel">
                    <div className="panel-header">Audit Result</div>
                    <div style={{ padding: '16px', fontFamily: 'var(--font-sans)', fontSize: '0.82rem', color: 'var(--green)' }}>
                      No flagged claims — all payments at or above threshold.
                    </div>
                  </div>
                )}
                {data.payer_breakdown.length > 0 && (
                  <PayerChart payers={data.payer_breakdown} />
                )}
              </div>
              <ChatPanel analysis={data} />
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    idle:    { color: 'var(--text-muted)',  dot: '#4a8898', label: 'Ready' },
    loading: { color: 'var(--amber)',       dot: '#f0a050', label: 'Processing' },
    done:    { color: 'var(--green)',       dot: '#52b788', label: 'Complete' },
    error:   { color: 'var(--red)',         dot: '#e05252', label: 'Error' },
  }
  const { color, dot, label } = map[status] || map.idle
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dot, display: 'inline-block' }} />
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.7rem', fontWeight: 500, color, letterSpacing: '0.04em' }}>
        {label}
      </span>
    </div>
  )
}
