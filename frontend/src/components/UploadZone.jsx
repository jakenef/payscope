import { useState, useRef } from 'react'

export default function UploadZone({ onUpload, loading }) {
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
      onClick={() => !loading && inputRef.current?.click()}
      className={`
        w-full rounded-xl border-2 border-dashed p-8 text-center cursor-pointer
        transition-colors duration-200
        ${dragging ? 'border-blue-400 bg-blue-900/20' : 'border-slate-600 hover:border-slate-400'}
        ${loading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
      {loading ? (
        <p className="text-slate-400 text-sm">Analyzing claims...</p>
      ) : (
        <>
          <p className="text-slate-300 font-medium">Drop your claims CSV here</p>
          <p className="text-slate-500 text-sm mt-1">or click to browse</p>
          <p className="text-slate-600 text-xs mt-2">
            Columns: Provider, Ptype, Cpt, Description, Charged, Paid
          </p>
        </>
      )}
    </div>
  )
}
