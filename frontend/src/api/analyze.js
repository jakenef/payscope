const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/**
 * @param {File} file
 * @param {{ specialty?: string, state?: string, contracts?: object[] }} [opts]
 * @returns {Promise<object>} analysis result from /api/analyze
 */
export async function analyzeCSV(file, opts = {}) {
  const formData = new FormData()
  formData.append('file', file)
  if (opts.specialty) formData.append('specialty', opts.specialty)
  if (opts.state) formData.append('state', opts.state)
  if (opts.contracts && opts.contracts.length > 0) {
    formData.append('contracts', JSON.stringify(opts.contracts))
  }

  const response = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail ?? `HTTP ${response.status}`)
  }

  return response.json()
}

export async function fetchBenchmarkOptions() {
  const r = await fetch(`${API_URL}/api/benchmark-options`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}
