import { useState } from 'react'
import { analyzeCSV } from './api/analyze'
import UploadZone from './components/UploadZone'
import ScoreSidebar from './components/ScoreSidebar'
import UnderpaymentTable from './components/UnderpaymentTable'
import PayerChart from './components/PayerChart'
import NarrativePanel from './components/NarrativePanel'

export default function App() {
  const [status, setStatus] = useState('idle')  // 'idle' | 'loading' | 'done' | 'error'
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

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Payscope</h1>
        <p className="text-slate-400 text-sm mt-1">Revenue Integrity Dashboard for Independent Physicians</p>
      </div>

      {/* Upload */}
      <div className="mb-6">
        <UploadZone onUpload={handleUpload} loading={status === 'loading'} />
      </div>

      {/* Error */}
      {status === 'error' && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-4 mb-6 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Dashboard */}
      {status === 'done' && data && (
        <div className="flex flex-col gap-6">
          {/* Row 1: Score sidebar + Table + Chart */}
          <div className="flex gap-6 items-start">
            {/* Left: Score sidebar */}
            <ScoreSidebar summary={data.summary} />

            {/* Right: Table + Chart stacked */}
            <div className="flex flex-col gap-6 flex-1 min-w-0">
              {data.underpayment_table.length > 0 ? (
                <UnderpaymentTable rows={data.underpayment_table} />
              ) : (
                <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-2xl p-6 text-emerald-300 text-sm">
                  No flagged claims — payments are at or above thresholds.
                </div>
              )}
              {data.payer_breakdown.length > 0 && (
                <PayerChart payers={data.payer_breakdown} />
              )}
            </div>
          </div>

          {/* Row 2: AI Narrative */}
          {data.ai_narrative && (
            <NarrativePanel narrative={data.ai_narrative} />
          )}
        </div>
      )}

      {/* Idle state */}
      {status === 'idle' && (
        <div className="text-center py-16 text-slate-600">
          <p className="text-lg">Upload a claims CSV to generate your revenue integrity report</p>
        </div>
      )}
    </div>
  )
}
