import { supabase } from '../auth/supabase'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/**
 * @param {{ state: string, taxonomyCode: string, limit?: number, skip?: number }} p
 */
export async function importFromNpiRegistry(p) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Sign in required')
  }
  const r = await fetch(`${API_URL}/api/admin/npi/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      state: p.state,
      taxonomy_code: p.taxonomyCode,
      limit: p.limit ?? 100,
      skip: p.skip ?? 0,
    }),
  })
  if (!r.ok) {
    let detail = `HTTP ${r.status}`
    try {
      const j = await r.json()
      if (j.detail) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return r.json()
}

export async function listLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createLead(lead) {
  const { data, error } = await supabase
    .from('leads')
    .insert(lead)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateLead(id, patch) {
  const { data, error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteLead(id) {
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) throw error
}

export async function listOutreach(leadId) {
  const { data, error } = await supabase
    .from('outreach_log')
    .select('*')
    .eq('lead_id', leadId)
    .order('occurred_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function logOutreach(entry) {
  const { data, error } = await supabase
    .from('outreach_log')
    .insert(entry)
    .select()
    .single()
  if (error) throw error
  return data
}

async function adminAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sign in required')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

export async function sendLobLetter(leadId) {
  const r = await fetch(`${API_URL}/api/admin/leads/${leadId}/letter`, {
    method: 'POST',
    headers: await adminAuthHeaders(),
  })
  if (!r.ok) {
    let detail = `HTTP ${r.status}`
    try {
      const j = await r.json()
      if (j.detail) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch { /* ignore */ }
    throw new Error(detail)
  }
  return r.json()
}

export async function triggerVoiceCall(leadId) {
  const r = await fetch(`${API_URL}/api/admin/leads/${leadId}/call`, {
    method: 'POST',
    headers: await adminAuthHeaders(),
  })
  if (!r.ok) {
    let detail = `HTTP ${r.status}`
    try {
      const j = await r.json()
      if (j.detail) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch { /* ignore */ }
    throw new Error(detail)
  }
  return r.json()
}

/**
 * Process due AI voice follow-ups (same auth as other admin routes).
 * @param {{ limit?: number }} [opts]
 */
export async function runVoiceTick(opts = {}) {
  const q = new URLSearchParams()
  if (opts.limit) q.set('limit', String(opts.limit))
  const r = await fetch(`${API_URL}/api/admin/voice/tick?${q}`, {
    method: 'POST',
    headers: await adminAuthHeaders(),
  })
  if (!r.ok) {
    let detail = `HTTP ${r.status}`
    try {
      const j = await r.json()
      if (j.detail) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch { /* ignore */ }
    throw new Error(detail)
  }
  return r.json()
}
