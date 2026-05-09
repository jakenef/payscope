/**
 * Hardcoded list of developer/admin emails. Anyone signed in with one of
 * these emails can access /admin. Update both this array AND the
 * is_payscope_admin() function in supabase/migrations when adding admins.
 */
export const ADMIN_EMAILS = [
  'maxp68034@gmail.com',
]

export function isAdminEmail(email) {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

export const LEAD_STATUSES = [
  { key: 'new',            label: 'New',            color: 'var(--text-muted)' },
  { key: 'contacted',      label: 'Contacted',      color: '#4a8898' },
  { key: 'replied',        label: 'Responded',      color: 'var(--primary-light)' },
  { key: 'demo_scheduled', label: 'Demo booked',    color: 'var(--amber)' },
  { key: 'demo_complete',  label: 'Demo complete',  color: 'var(--amber)' },
  { key: 'won',            label: 'Won',            color: 'var(--green)' },
  { key: 'lost',           label: 'Lost',           color: 'var(--red)' },
]

/** NUCC taxonomy presets for NPI Registry (NPI-2 org). Custom codes allowed. */
export const NPI_TAXONOMY_PRESETS = [
  { value: '207Y00000X', label: 'ENT — Otolaryngology (207Y00000X)' },
  { value: '122300000X', label: 'Dentistry — General Practice (122300000X)' },
]
