import { useState, useRef } from 'react'

export default function UploadZone({ onUpload }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFile = (file) => {
    if (!file) return
    const name = file.name.toLowerCase()
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) return
    onUpload(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`upload-zone${dragging ? ' dragging' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />

      <div style={{
        fontFamily: 'var(--font-sans)', fontWeight: 600,
        fontSize: '0.85rem', color: 'var(--text-bright)',
        marginBottom: '6px',
      }}>
        {dragging ? 'Drop to upload' : 'Drop CSV or Excel file here or click to browse'}
      </div>

      <div style={{
        fontFamily: 'var(--font-sans)', fontSize: '0.68rem',
        color: 'var(--text-muted)', letterSpacing: '0.04em',
      }}>
        Columns auto-detected · CSV, XLSX, XLS supported
      </div>
    </div>
  )
}
