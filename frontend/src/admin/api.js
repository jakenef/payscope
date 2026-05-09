import { supabase } from '../auth/supabase'

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
