-- Outreach integration: NPI sourcing, Lob letter tracking, AI call fields

alter table public.leads
  add column if not exists npi text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists zip text,
  add column if not exists taxonomy_code text,
  add column if not exists lob_address_id text,
  add column if not exists lob_letter_id text,
  add column if not exists letter_status text,
  add column if not exists letter_requested_at timestamptz,
  add column if not exists letter_sent_at timestamptz,
  add column if not exists voice_followup_after timestamptz,
  add column if not exists last_voice_call_at timestamptz,
  add column if not exists voice_call_outcome text,
  add column if not exists twilio_call_sid text,
  add column if not exists do_not_call boolean not null default false;

comment on column public.leads.npi is 'CMS NPPES NPI-2 organizational NPI when sourced from registry';
comment on column public.leads.letter_status is 'lob workflow: queued | submitted | rendered | mailed | failed';
comment on column public.leads.voice_followup_after is 'Eligible for AI voice follow-up after this instant (typically ~7–10d after mail)';

create unique index if not exists leads_npi_uidx on public.leads (npi) where npi is not null;
