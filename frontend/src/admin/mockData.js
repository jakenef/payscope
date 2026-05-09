/**
 * Faux outreach data for dashboard design / integration-paused preview.
 *
 * - VITE_ADMIN_USE_MOCK_DATA=true  → mock data (local dev and production builds)
 * - VITE_ADMIN_USE_MOCK_DATA=false → always use real Supabase
 * - unset → mock in dev only; production uses real Supabase
 */
export function isAdminMockMode() {
  const v = import.meta.env.VITE_ADMIN_USE_MOCK_DATA
  if (v === 'true') return true
  if (v === 'false') return false
  return import.meta.env.DEV
}

const iso = (d) => d.toISOString()

/** @type {Record<string, object[]>} */
export const MOCK_OUTREACH_BY_LEAD = {
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001': [
    { id: 'o1', lead_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001', channel: 'mail', direction: 'outbound', subject: 'Intro letter (Lob)', body: 'Lob letter id ltr_mock_01', outcome: 'rendered', meta: {}, occurred_at: iso(new Date(Date.now() - 86400000 * 5)) },
    { id: 'o2', lead_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001', channel: 'mail', direction: 'inbound', subject: 'Lob webhook: letter.in_transit', body: '', outcome: 'letter.in_transit', meta: {}, occurred_at: iso(new Date(Date.now() - 86400000 * 3)) },
  ],
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002': [
    { id: 'o3', lead_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002', channel: 'call', direction: 'outbound', subject: 'Twilio status', body: '{"CallStatus":"completed"}', outcome: 'completed_184s', meta: {}, occurred_at: iso(new Date(Date.now() - 86400000 * 1)) },
  ],
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0004': [
    { id: 'o4', lead_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0004', channel: 'email', direction: 'outbound', subject: 'Follow-up', body: 'Quick note after our letter…', outcome: 'sent', meta: {}, occurred_at: iso(new Date(Date.now() - 3600000 * 8)) },
  ],
}

/** @type {object[]} */
export const MOCK_LEADS_SEED = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
    practice_name: 'Bay Area ENT Partners',
    contact_name: 'Dr. Jordan Reeves',
    email: 'billing@bayareaent.example',
    phone: '+14155550172',
    specialty: 'Otolaryngology',
    state: 'CA',
    status: 'contacted',
    source: 'npi_registry',
    notes: 'Strong commercial payer mix; asked for demo link in letter.',
    npi: '1992999981',
    address_line1: '1200 Medical Plaza Dr',
    address_line2: 'Suite 400',
    city: 'Oakland',
    zip: '94612',
    taxonomy_code: '207Y00000X',
    lob_address_id: 'adr_mock_01',
    lob_letter_id: 'ltr_mock_01',
    letter_status: 'in_transit',
    letter_requested_at: iso(new Date(Date.now() - 86400000 * 5)),
    letter_sent_at: iso(new Date(Date.now() - 86400000 * 3)),
    voice_followup_after: iso(new Date(Date.now() + 86400000 * 2)),
    last_voice_call_at: null,
    voice_call_outcome: null,
    twilio_call_sid: null,
    do_not_call: false,
    elevenlabs_conversation_id: null,
    created_at: iso(new Date(Date.now() - 86400000 * 14)),
    updated_at: iso(new Date(Date.now() - 86400000)),
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002',
    practice_name: 'Soundview Oral Surgery',
    contact_name: 'Maria Santos',
    email: 'frontdesk@soundvieworal.example',
    phone: '+12065550188',
    specialty: 'Dentistry — Oral Surgery',
    state: 'WA',
    status: 'replied',
    source: 'npi_registry',
    notes: 'Office manager called back — interested in revenue integrity benchmark.',
    npi: '1881881883',
    address_line1: '4500 Aurora Ave N',
    city: 'Seattle',
    zip: '98103',
    taxonomy_code: '122300000X',
    lob_letter_id: 'ltr_mock_02',
    letter_status: 'delivered',
    letter_sent_at: iso(new Date(Date.now() - 86400000 * 10)),
    voice_followup_after: iso(new Date(Date.now() - 86400000 * 1)),
    last_voice_call_at: iso(new Date(Date.now() - 86400000 * 1)),
    voice_call_outcome: 'completed_184s',
    twilio_call_sid: 'CA_mock_soundview',
    do_not_call: false,
    created_at: iso(new Date(Date.now() - 86400000 * 20)),
    updated_at: iso(new Date(Date.now() - 86400000)),
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0003',
    practice_name: 'Capitol Hill ENT Clinic',
    contact_name: '—',
    email: null,
    phone: '+12025550901',
    specialty: 'Otolaryngology',
    state: 'DC',
    status: 'new',
    source: 'npi_registry',
    notes: '',
    npi: '1771771771',
    address_line1: '1800 I St NW',
    city: 'Washington',
    zip: '20006',
    taxonomy_code: '207Y00000X',
    letter_status: null,
    voice_followup_after: null,
    last_voice_call_at: null,
    do_not_call: false,
    created_at: iso(new Date(Date.now() - 86400000 * 2)),
    updated_at: iso(new Date(Date.now() - 86400000 * 2)),
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0004',
    practice_name: 'Lakeside Family Dentistry',
    contact_name: 'Dr. Amira Hassan',
    email: 'ahassan@lakesidedds.example',
    phone: '+16125550422',
    specialty: 'General Practice Dentistry',
    state: 'MN',
    status: 'demo_scheduled',
    source: 'referral',
    notes: 'Demo Thu 2pm — synthetic ENT cohort requested.',
    npi: '1661661662',
    address_line1: '890 Lake St E',
    city: 'Minneapolis',
    zip: '55408',
    lob_letter_id: 'ltr_mock_04',
    letter_status: 'mailed',
    letter_sent_at: iso(new Date(Date.now() - 86400000 * 12)),
    voice_followup_after: iso(new Date(Date.now() - 86400000 * 2)),
    last_voice_call_at: null,
    voice_call_outcome: null,
    do_not_call: false,
    created_at: iso(new Date(Date.now() - 86400000 * 30)),
    updated_at: iso(new Date(Date.now() - 86400000)),
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0005',
    practice_name: 'Pediatric ENT of Austin',
    contact_name: 'Taylor Chen',
    email: 'tchen@pedsentaustin.example',
    phone: '+15125550777',
    specialty: 'Otolaryngology — Pediatric',
    state: 'TX',
    status: 'demo_complete',
    source: 'npi_registry',
    notes: 'Loved payer variance table; evaluating vs current RCM vendor.',
    npi: '1551551555',
    address_line1: '3400 Medical Pkwy',
    city: 'Austin',
    zip: '78705',
    letter_status: 'delivered',
    letter_sent_at: iso(new Date(Date.now() - 86400000 * 18)),
    voice_followup_after: iso(new Date(Date.now() - 86400000 * 10)),
    last_voice_call_at: iso(new Date(Date.now() - 86400000 * 9)),
    voice_call_outcome: 'completed_201s',
    twilio_call_sid: 'CA_mock_pedsent',
    do_not_call: false,
    elevenlabs_conversation_id: 'conv_mock_5',
    created_at: iso(new Date(Date.now() - 86400000 * 40)),
    updated_at: iso(new Date(Date.now() - 86400000)),
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0006',
    practice_name: 'Coastal Dental Group',
    contact_name: 'Office',
    email: 'info@coastaldental.example',
    phone: '+13055550111',
    specialty: 'General Practice Dentistry',
    state: 'FL',
    status: 'won',
    source: 'npi_registry',
    notes: 'Signed — onboarding next week.',
    npi: '1441441444',
    address_line1: '2200 Ocean Dr',
    city: 'Miami',
    zip: '33139',
    letter_status: 'delivered',
    letter_sent_at: iso(new Date(Date.now() - 86400000 * 45)),
    voice_followup_after: iso(new Date(Date.now() - 86400000 * 35)),
    last_voice_call_at: iso(new Date(Date.now() - 86400000 * 34)),
    voice_call_outcome: 'completed_312s',
    do_not_call: false,
    created_at: iso(new Date(Date.now() - 86400000 * 60)),
    updated_at: iso(new Date(Date.now() - 86400000)),
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0007',
    practice_name: 'Rocky Mountain ENT',
    contact_name: '—',
    email: null,
    phone: null,
    specialty: 'Otolaryngology',
    state: 'CO',
    status: 'lost',
    source: 'npi_registry',
    notes: 'Not interested — fully insourced billing.',
    npi: '1331331333',
    address_line1: '500 Health Center Dr',
    city: 'Denver',
    zip: '80230',
    letter_status: 'failed',
    letter_sent_at: null,
    voice_followup_after: null,
    last_voice_call_at: null,
    do_not_call: true,
    created_at: iso(new Date(Date.now() - 86400000 * 25)),
    updated_at: iso(new Date(Date.now() - 86400000 * 5)),
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0008',
    practice_name: 'Summit Smiles Orthodontics',
    contact_name: 'Dr. Leo Park',
    email: 'lpark@summitsmiles.example',
    phone: '+18015550234',
    specialty: 'Dentistry — Orthodontics',
    state: 'UT',
    status: 'contacted',
    source: 'npi_registry',
    notes: '',
    npi: '1221221222',
    address_line1: '88 Summit Blvd',
    city: 'Salt Lake City',
    zip: '84111',
    lob_letter_id: 'ltr_mock_08',
    letter_status: 'rendered',
    letter_requested_at: iso(new Date(Date.now() - 86400000 * 1)),
    voice_followup_after: null,
    last_voice_call_at: null,
    do_not_call: false,
    created_at: iso(new Date(Date.now() - 86400000 * 8)),
    updated_at: iso(new Date(Date.now() - 86400000)),
  },
]

export function cloneMockLeads() {
  return MOCK_LEADS_SEED.map((l) => ({ ...l }))
}

export function cloneMockOutreachMap() {
  const out = {}
  for (const [k, v] of Object.entries(MOCK_OUTREACH_BY_LEAD)) {
    out[k] = v.map((o) => ({ ...o }))
  }
  return out
}

export function getOutreachForLead(leadId, outreachMap) {
  return outreachMap[leadId] ? [...outreachMap[leadId]] : []
}
