-- Allow physical mail in outreach_log; optional ElevenLabs id on leads

alter table public.outreach_log drop constraint if exists outreach_log_channel_check;

alter table public.outreach_log
  add constraint outreach_log_channel_check
  check (channel in ('email', 'call', 'sms', 'mail'));

alter table public.leads
  add column if not exists elevenlabs_conversation_id text;

comment on column public.leads.elevenlabs_conversation_id is 'Set from ElevenLabs post-call webhook when available';
