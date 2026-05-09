import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { parseContractPdf } from '../api/contracts'
import { loadContracts, addContract, deleteContract } from '../contracts/store'

export default function ContractsPanel({ onChange }) {
  const { user } = useAuth()
  const [contracts, setContracts] = useState([])
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState(null)
  const [reviewing, setReviewing] = useState(null) // parsed contract pending review

  useEffect(() => {
    setContracts(loadContracts(user?.id))
  }, [user?.id])

  const refresh = () => {
    const list = loadContracts(user?.id)
    setContracts(list)
    onChange?.(list)
  }

  const handleFile = async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.')
      return
    }
    setError(null); setParsing(true)
    try {
      const parsed = await parseContractPdf(file)
      setReviewing(parsed)
    } catch (ex) {
      setError(ex.message)
    } finally {
      setParsing(false)
    }
  }

  const handleSave = (verifiedContract) => {
    addContract(user?.id, verifiedContract)
    setReviewing(null)
    refresh()
  }

  const handleDelete = (id) => {
    deleteContract(user?.id, id)
    refresh()
  }

  return (
    <div className="panel">
      <div className="panel-header">
        Participating Partner Agreements
        <span className="panel-tag">{contracts.length} saved</span>
      </div>
      <div style={{ padding: '24px 22px 22px' }}>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: '0.8rem',
          color: 'var(--text-muted)', lineHeight: 1.6,
          marginBottom: '20px',
        }}>
          Upload your insurance contract PDFs. Payscope extracts contracted rates
          and uses them to flag claims paid below what your contract guarantees.
        </p>

        <PdfDropZone onFile={handleFile} parsing={parsing} />

        {error && (
          <div style={{
            padding: '8px 10px', marginTop: '12px',
            background: 'var(--red-bg)', border: '1px solid var(--red)',
            fontFamily: 'var(--font-sans)', fontSize: '0.74rem',
            color: 'var(--red)',
          }}>{error}</div>
        )}

        {/* Saved contracts list */}
        {contracts.length > 0 && (
          <ul style={{ listStyle: 'none', marginTop: '16px' }}>
            {contracts.map((c) => (
              <li key={c.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--text-dim)',
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontFamily: 'var(--font-sans)', fontSize: '0.82rem',
                    fontWeight: 500, color: 'var(--text-bright)',
                  }}>{c.payer_name}</div>
                  <div style={{
                    fontFamily: 'var(--font-sans)', fontSize: '0.7rem',
                    color: 'var(--text-muted)', marginTop: '2px',
                  }}>
                    {c.rates.length} rates
                    {c.effective_date && ` · effective ${c.effective_date}`}
                    {c.expiration_date && ` → ${c.expiration_date}`}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="btn"
                  style={{ padding: '3px 10px', fontSize: '0.65rem', color: 'var(--red)', borderColor: 'var(--red)' }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {reviewing && (
        <ReviewModal
          contract={reviewing}
          onSave={handleSave}
          onCancel={() => setReviewing(null)}
        />
      )}
    </div>
  )
}

function ReviewModal({ contract, onSave, onCancel }) {
  const [draft, setDraft] = useState(contract)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const updateRate = (i, field, value) => {
    const next = [...draft.rates]
    next[i] = { ...next[i], [field]: value === '' ? null : value }
    setDraft({ ...draft, rates: next })
  }

  const removeRate = (i) => {
    const next = draft.rates.filter((_, idx) => idx !== i)
    setDraft({ ...draft, rates: next })
  }

  const updateField = (field, value) => setDraft({ ...draft, [field]: value })

  const save = () => {
    // Coerce numerics from text inputs
    const cleaned = {
      ...draft,
      rates: draft.rates
        .filter((r) => (r.cpt || '').trim())
        .map((r) => ({
          cpt: String(r.cpt).trim(),
          description: r.description || null,
          allowed_amount: r.allowed_amount !== null && r.allowed_amount !== '' ? Number(r.allowed_amount) : null,
        })),
    }
    if (cleaned.rates.length === 0) {
      alert('At least one rate row is required.')
      return
    }
    onSave(cleaned)
  }

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(5,14,18,0.82)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel fade-up"
        style={{
          width: '100%', maxWidth: '720px', maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div className="panel-header">
          Review extracted contract
          <span className="panel-tag">Edit · Esc to cancel</span>
        </div>

        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
            <Field label="Payer">
              <input
                type="text" value={draft.payer_name || ''} onChange={(e) => updateField('payer_name', e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Effective">
              <input
                type="date" value={draft.effective_date || ''} onChange={(e) => updateField('effective_date', e.target.value || null)}
                style={inputStyle}
              />
            </Field>
            <Field label="Expires">
              <input
                type="date" value={draft.expiration_date || ''} onChange={(e) => updateField('expiration_date', e.target.value || null)}
                style={inputStyle}
              />
            </Field>
          </div>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: '0.7rem',
            color: 'var(--text-muted)', marginTop: '8px',
          }}>
            <strong style={{ color: 'var(--amber)' }}>Important:</strong> the payer name here must match the payer
            code in your claims CSV (e.g. "BCBS", "AETNA"). Edit if needed.
          </p>
        </div>

        <div style={{ padding: '10px 16px', flex: 1, overflowY: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontFamily: 'var(--font-mono)', fontSize: '0.74rem',
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={thStyle}>CPT</th>
                <th style={{ ...thStyle, width: '50%' }}>Description</th>
                <th style={thStyle}>Allowed $</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {draft.rates.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--text-dim)' }}>
                  <td style={tdStyle}>
                    <input value={r.cpt || ''} onChange={(e) => updateRate(i, 'cpt', e.target.value)} style={cellInput} />
                  </td>
                  <td style={tdStyle}>
                    <input value={r.description || ''} onChange={(e) => updateRate(i, 'description', e.target.value)} style={cellInput} />
                  </td>
                  <td style={tdStyle}>
                    <input type="number" step="any" value={r.allowed_amount ?? ''} onChange={(e) => updateRate(i, 'allowed_amount', e.target.value)} style={cellInput} />
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => removeRate(i)} style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--red)', fontFamily: 'var(--font-sans)', fontSize: '0.72rem',
                    }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{
          display: 'flex', gap: '8px', padding: '12px 16px',
          borderTop: '1px solid var(--border)', justifyContent: 'flex-end',
        }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className="btn"
            onClick={save}
            style={{
              background: 'rgba(42,157,143,0.16)',
              borderColor: 'var(--primary)', color: 'var(--primary-light)',
            }}
          >
            Save contract
          </button>
        </div>
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
  fontSize: '0.82rem',
  padding: '6px 8px',
  outline: 'none',
}

const cellInput = {
  ...inputStyle,
  fontFamily: 'var(--font-mono)',
  fontSize: '0.74rem',
  padding: '4px 6px',
}

const thStyle = {
  textAlign: 'left',
  padding: '6px 8px',
  fontFamily: 'var(--font-sans)',
  fontSize: '0.6rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

const tdStyle = { padding: '4px 4px' }

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{
        fontFamily: 'var(--font-sans)', fontSize: '0.6rem',
        fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--text-muted)', marginBottom: '4px',
      }}>{label}</div>
      {children}
    </label>
  )
}

function PdfDropZone({ onFile, parsing }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const pickFile = () => { if (!parsing) inputRef.current?.click() }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (parsing) return
    onFile(e.dataTransfer.files[0])
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!parsing) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={pickFile}
      className={`upload-zone${dragging ? ' dragging' : ''}`}
      style={{ cursor: parsing ? 'wait' : 'pointer', opacity: parsing ? 0.7 : 1 }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files[0])}
      />

      <div style={{
        fontFamily: 'var(--font-sans)', fontWeight: 600,
        fontSize: '0.85rem', color: 'var(--text-bright)',
        marginBottom: '6px',
      }}>
        {parsing
          ? <>Extracting fee schedule<span className="blink-cursor" /></>
          : dragging ? 'Drop to upload' : 'Drop contract PDF here or click to browse'}
      </div>

      <div style={{
        fontFamily: 'var(--font-sans)', fontSize: '0.68rem',
        color: 'var(--text-muted)', letterSpacing: '0.04em',
      }}>
        Payer name, dates, and CPT rates auto-extracted · PDF only
      </div>
    </div>
  )
}
