import { useState, useRef } from 'react'

export default function UploadZone({ onUpload }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFile = (file) => {
    if (!file || !file.name.endsWith('.csv')) return
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
        accept=".csv"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />

      <div style={{
        fontFamily: 'var(--font-sans)', fontWeight: 600,
        fontSize: '0.85rem', color: 'var(--text-bright)',
        marginBottom: '6px',
      }}>
        {dragging ? 'Drop to upload' : 'Drop CSV file here or click to browse'}
      </div>

      <div style={{
        fontFamily: 'var(--font-sans)', fontSize: '0.68rem',
        color: 'var(--text-muted)', letterSpacing: '0.04em',
      }}>
        Columns required: Provider · Ptype · CPT · Description · Charged · Paid
      </div>
    </div>
  )
}
