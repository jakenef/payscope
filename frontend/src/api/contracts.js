const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/**
 * Upload a participating-provider agreement PDF and get back a structured contract
 * (payer_name, dates, rates: [{cpt, description, allowed_amount}]).
 * Does not persist anything — the frontend stores the result locally after review.
 */
export async function parseContractPdf(file) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`${API_URL}/api/contracts/parse`, {
    method: 'POST',
    body: fd,
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: `HTTP ${r.status}` }))
    throw new Error(e.detail || `HTTP ${r.status}`)
  }
  return r.json()
}
