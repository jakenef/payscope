-- ─── Admin: prospect leads + outreach history ──────────────────────────────
-- Hidden from regular users via RLS that checks the caller's email against
-- a hardcoded allowlist. Update the email list inline when admins change.

create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  practice_name text not null,
  contact_name text,
  email text,
  phone text,
  specialty text,
  state text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'replied', 'demo_scheduled', 'demo_complete', 'won', 'lost')),
  source text,
  notes text,
  next_action_at timestamptz,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_next_action_idx on public.leads (next_action_at);

create table if not exists public.outreach_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null check (channel in ('email', 'call', 'sms')),
  direction text not null check (direction in ('outbound', 'inbound')),
  subject text,
  body text,
  outcome text,
  meta jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists outreach_log_lead_idx on public.outreach_log (lead_id, occurred_at desc);

-- Auto-update updated_at on lead changes
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at before update on public.leads
  for each row execute function public.touch_updated_at();

-- ─── RLS: admin email allowlist ─────────────────────────────────────────────
-- Edit this function's array to add/remove admins. Then `supabase db push`.
create or replace function public.is_payscope_admin() returns boolean
language sql stable as $$
  select coalesce(
    (auth.jwt() ->> 'email') = any(array[
      'maxp68034@gmail.com'
    ]::text[]),
    false
  );
$$;

alter table public.leads enable row level security;
alter table public.outreach_log enable row level security;

drop policy if exists "admin_only_leads" on public.leads;
create policy "admin_only_leads" on public.leads
  for all
  using (public.is_payscope_admin())
  with check (public.is_payscope_admin());

drop policy if exists "admin_only_outreach" on public.outreach_log;
create policy "admin_only_outreach" on public.outreach_log
  for all
  using (public.is_payscope_admin())
  with check (public.is_payscope_admin());
