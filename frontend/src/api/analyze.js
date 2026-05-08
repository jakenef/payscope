const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/**
 * @param {File} file
 * @returns {Promise<object>} analysis result from /api/analyze
 */
export async function analyzeCSV(file) {
  const formData = new FormData()
  formData.append('file', file)

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
