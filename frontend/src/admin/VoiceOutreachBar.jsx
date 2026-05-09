import { useState } from 'react'
import { runVoiceTick } from './api'

export default function VoiceOutreachBar({ onDone }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const run = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await runVoiceTick({ limit: 5 })
      const ok = res.results?.filter((r) => r.call_sid).length ?? 0
      setMsg({ type: 'ok', text: `Queue: ${res.due_count} due · started ${ok} call(s)` })
      onDone?.()
    } catch (e) {
      setMsg({ type: 'err', text: e.message || String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel" style={{ marginBottom: '20px' }}>
      <div className="panel-header" style={{ borderBottom: '1px solid var(--border-mid)' }}>
        <span>AI voice queue</span>
        <span className="panel-tag">Twilio + ElevenLabs</span>
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <p style={{
          margin: 0,
          flex: '1 1 220px',
          fontFamily: 'var(--font-sans)', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5,
        }}>
          Dials leads where <code style={{ color: 'var(--primary-light)' }}>voice_followup_after</code> has passed (set by Lob mail webhooks), phone is E.164, not DNC, and no prior call logged.
          For production, schedule <code style={{ color: 'var(--primary-light)' }}>POST /api/admin/voice/tick</code> with <code style={{ color: 'var(--primary-light)' }}>X-Admin-Key</code>.
        </p>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={run} style={{ padding: '8px 16px' }}>
          {busy ? 'Running…' : 'Run voice tick (max 5)'}
        </button>
      </div>
      {msg && (
        <div style={{
          margin: '0 14px 12px',
          padding: '8px 10px',
          border: `1px solid ${msg.type === 'ok' ? 'var(--primary)' : 'var(--red)'}`,
          background: msg.type === 'ok' ? 'rgba(42,157,143,0.08)' : 'var(--red-bg)',
          color: msg.type === 'ok' ? 'var(--primary-light)' : 'var(--red)',
          fontFamily: 'var(--font-sans)', fontSize: '0.74rem',
        }}>{msg.text}</div>
      )}
    </div>
  )
}
