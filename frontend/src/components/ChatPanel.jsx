import { useEffect, useRef, useState } from 'react'
import { sendChat } from '../api/chat'

const SUGGESTED_PROMPTS = [
  'Which payer is hurting us most?',
  'What CPT codes are most underpaid?',
  'Give me 3 actions to fix the top issue.',
]

export default function ChatPanel({ analysis }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const send = async (text) => {
    const content = text.trim()
    if (!content || loading) return
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setError(null)
    setLoading(true)
    try {
      const reply = await sendChat(next, analysis)
      setMessages([...next, reply])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="panel" style={{
      width: '340px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      height: '640px',
    }}>
      <div className="panel-header">
        <span>Ask Payscope</span>
        {messages.length > 0 ? (
          <button
            onClick={() => { setMessages([]); setError(null) }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '0.62rem',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        ) : (
          <span className="panel-tag">grounded in your data</span>
        )}
      </div>

      <div ref={scrollRef} style={{
        flex: 1,
        overflowY: 'auto',
        padding: '14px 14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              fontSize: '0.65rem',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '4px',
            }}>
              Try asking
            </div>
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                style={{
                  textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.78rem',
                  color: 'var(--text-bright)',
                  background: 'var(--bg-panel-alt)',
                  border: '1px solid var(--border)',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '0.8rem',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              padding: '8px 10px',
              border: '1px solid',
              ...(m.role === 'user'
                ? {
                    alignSelf: 'flex-end',
                    maxWidth: '88%',
                    background: 'rgba(42, 157, 143, 0.10)',
                    borderColor: 'var(--primary-dark)',
                    color: 'var(--text-bright)',
                  }
                : {
                    alignSelf: 'flex-start',
                    maxWidth: '92%',
                    background: 'var(--bg-panel-alt)',
                    borderColor: 'var(--border)',
                    color: 'var(--text)',
                  }),
            }}
          >
            {m.content}
          </div>
        ))}

        {loading && (
          <div style={{
            alignSelf: 'flex-start',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.78rem',
            fontStyle: 'italic',
            color: 'var(--text-muted)',
          }}>
            Thinking<span className="blink-cursor" />
          </div>
        )}

        {error && (
          <div style={{
            background: 'var(--red-bg)',
            border: '1px solid var(--red)',
            padding: '8px 10px',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.75rem',
            color: 'var(--red)',
          }}>
            {error}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} style={{
        padding: '10px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: '8px',
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your data..."
          disabled={loading}
          style={{
            flex: 1,
            background: 'var(--bg-dark)',
            color: 'var(--text-bright)',
            border: '1px solid var(--border)',
            padding: '7px 10px',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.8rem',
            outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn"
          style={{
            opacity: (loading || !input.trim()) ? 0.4 : 1,
            cursor: (loading || !input.trim()) ? 'not-allowed' : 'pointer',
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}
