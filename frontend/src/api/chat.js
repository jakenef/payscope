const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/**
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} analysis - the most recent analysis result
 * @returns {Promise<{role: string, content: string}>}
 */
export async function sendChat(messages, analysis) {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, analysis }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail ?? `HTTP ${response.status}`)
  }

  return response.json()
}
