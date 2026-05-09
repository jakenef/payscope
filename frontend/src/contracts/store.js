/**
 * Per-user contracts store, persisted to localStorage.
 *
 * Shape on disk: array of contracts. Each contract:
 *   {
 *     id: string,
 *     payer_name: string,
 *     effective_date: string|null,
 *     expiration_date: string|null,
 *     contract_number: string|null,
 *     raw_filename: string|null,
 *     uploaded_at: string,
 *     rates: [ {cpt, description, pct_of_medicare, allowed_amount}, ... ],
 *   }
 */

const KEY_PREFIX = 'payscope.contracts.v1.'

function keyFor(userId) {
  return `${KEY_PREFIX}${userId || 'anon'}`
}

export function loadContracts(userId) {
  try {
    const raw = localStorage.getItem(keyFor(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveContracts(userId, contracts) {
  localStorage.setItem(keyFor(userId), JSON.stringify(contracts))
}

export function addContract(userId, contract) {
  const list = loadContracts(userId)
  const withId = {
    ...contract,
    id: contract.id || `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    uploaded_at: contract.uploaded_at || new Date().toISOString(),
  }
  list.push(withId)
  saveContracts(userId, list)
  return withId
}

export function deleteContract(userId, contractId) {
  const next = loadContracts(userId).filter((c) => c.id !== contractId)
  saveContracts(userId, next)
  return next
}
