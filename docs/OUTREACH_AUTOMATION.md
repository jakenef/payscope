# Outreach Automation — Build Plan

This document is a handoff for the autonomous-outreach feature. It describes
the four remaining stages (after the admin scaffold), with concrete schema,
file paths, code patterns, and gotchas.

**Read [`CLAUDE.md`](../CLAUDE.md) first** for codebase conventions.

---

## Current state (what's already built)

- **Hidden admin route** at `/admin` — pathname-based gate in `frontend/src/main.jsx`
  renders `AdminApp` instead of `App` when path starts with `/admin`.
- **Email allowlist** in `frontend/src/admin/config.js` (`ADMIN_EMAILS` const)
  and in Supabase via `is_payscope_admin()` SQL function (migration
  `20260509180408_admin_leads.sql`). Both must stay in sync.
- **Schema**:
  - `public.leads` — practice info, status enum, contact fields, timestamps
  - `public.outreach_log` — channel/direction/outcome history per lead
  - RLS policies restrict both to admins
- **Frontend**:
  - `src/admin/AdminApp.jsx` — pipeline view (7 status columns)
  - `src/admin/LeadDrawer.jsx` — create/edit/delete + outreach history viewer
  - `src/admin/api.js` — Supabase CRUD helpers (`listLeads`, `createLead`,
    `updateLead`, `deleteLead`, `listOutreach`, `logOutreach`)
- **Vercel rewrite** at `frontend/vercel.json` so `/admin` resolves to the SPA
  in production.
- **Email infra** — Resend SMTP wired into Supabase auth (signup/recovery
  emails). API key set via `RESEND_API_KEY` env var on `supabase config push`.
  Resend account is on the free tier (1 verified domain:
  `payscope.scalr.media`).
- **Backend** — FastAPI with `OPENAI_API_KEY` (GPT-4o), `OPENROUTER_API_KEY`
  fallback. CORS open. Already deployed at `https://payscope-jgoa.onrender.com`.
- **Frontend** — Vite + React 19, deployed at `https://payscope-two.vercel.app`.
- **Auth** — Supabase, profile fields (`specialty`, `state`) in `user_metadata`.
- **Billing** — *None.* The "$50/month" on the landing page is currently
  decorative. Stripe integration is Stage 4.

---

## Conventions to follow

- **No new dependencies without strong reason.** Frontend already has
  `@supabase/supabase-js`, `recharts`, `d3-geo`, `topojson-client`,
  `react-markdown`. Backend has `pdfplumber`, `pandas`, `openai`, `fastapi`,
  `python-dotenv`.
- **Styling**: inline styles + CSS variables defined in `src/index.css`
  (`--primary`, `--bg-panel`, `--text-bright`, etc.). Don't introduce
  Tailwind classes ad-hoc, stick with the existing pattern. Reusable patterns
  in CSS: `.panel`, `.panel-header`, `.btn`, `.btn-primary`, `.upload-zone`,
  `.data-table`, `.kpi-row`, `.fade-up`.
- **Backend endpoints** live in `backend/main.py`. Module logic in separate
  files (`analyzer.py`, `contracts.py`, `benchmarks.py`, `ai.py`, `chat.py`,
  `llm.py`). Keep `main.py` as a thin routing layer.
- **Migrations**: `supabase migration new <name>` then write SQL into the
  generated file. Push with `supabase db push --yes`. Never edit applied
  migrations — create a new one.
- **Secrets**: never commit. Reference via `env(VAR_NAME)` in `config.toml`,
  or `os.getenv` in Python. Frontend reads `import.meta.env.VITE_*`.
- **Commits**: descriptive, lowercase prefix (`feat:`, `fix:`, `chore:`).
  Always create new commits, never amend. Include `Co-Authored-By` trailer
  for AI-assisted commits per existing pattern.

---

## Stage 2: Email outreach via Resend

### Goal
Send templated cold emails to leads on a schedule. Capture opens, clicks,
replies. Move leads through the pipeline automatically based on engagement.

### Decisions made
- **Email provider**: Resend (already integrated for auth emails). Use the
  same domain (`payscope.scalr.media`) and API key.
- **Sequence engine**: server-side cron, not a 3rd-party tool like
  Customer.io or Apollo (cost + complexity). Run inside the FastAPI backend
  on Render with a scheduler.
- **Reply detection**: Resend's inbound webhooks. Set up an inbound route
  `replies@payscope.scalr.media` that POSTs to the backend.

### Decisions still open
- **Sequence content** — write 3-5 cold-email variants. Should reference
  the prospect's specialty (`leads.specialty`) and state (`leads.state`),
  ideally with a personalized hook (LLM-generated based on practice name).
- **Send cadence** — proposed: Day 0 (intro), Day 3 (follow-up + sample
  insight), Day 7 (case study), Day 14 (last-attempt). Stop sequence on
  reply or unsubscribe.
- **Personalization tier** — pure templates (cheap, fast) vs LLM-rewritten
  per lead (better reply rate, $0.01-0.05 per email at GPT-4o-mini prices).
  Recommend: hybrid — fixed body, LLM-generated opener line.

### Schema changes

```sql
-- New migration: supabase/migrations/<ts>_email_sequences.sql

create table if not exists public.email_sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.email_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  step_number int not null,
  delay_days int not null default 0,         -- days after previous step (or after enrollment for step 1)
  subject_template text not null,
  body_template text not null,               -- Mustache-style {{lead.practice_name}}, {{lead.specialty}}
  ai_personalize boolean default false,      -- if true, LLM rewrites the opener
  unique (sequence_id, step_number)
);

create table if not exists public.lead_enrollments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  current_step int not null default 0,
  next_send_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'replied', 'unsubscribed')),
  enrolled_at timestamptz not null default now(),
  unique (lead_id, sequence_id)
);

create index if not exists lead_enrollments_due_idx
  on public.lead_enrollments (next_send_at)
  where status = 'active';

-- Apply same admin RLS to all three
alter table public.email_sequences enable row level security;
alter table public.email_steps enable row level security;
alter table public.lead_enrollments enable row level security;

create policy admin_only_seq on public.email_sequences for all
  using (public.is_payscope_admin()) with check (public.is_payscope_admin());
create policy admin_only_step on public.email_steps for all
  using (public.is_payscope_admin()) with check (public.is_payscope_admin());
create policy admin_only_enroll on public.lead_enrollments for all
  using (public.is_payscope_admin()) with check (public.is_payscope_admin());
```

### Backend additions

**`backend/email_sender.py`** — wraps Resend HTTP API.

```python
import os, requests
RESEND_API = "https://api.resend.com/emails"

def send_email(to: str, subject: str, html: str, text: str | None = None,
               reply_to: str = "replies@payscope.scalr.media",
               headers: dict | None = None) -> dict:
    """Returns Resend response dict. Caller logs to outreach_log."""
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        raise RuntimeError("RESEND_API_KEY not set")
    r = requests.post(
        RESEND_API,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "from": "Payscope <noreply@payscope.scalr.media>",
            "to": [to],
            "reply_to": reply_to,
            "subject": subject,
            "html": html,
            "text": text or _html_to_text(html),
            "headers": headers or {},
        },
        timeout=15,
    )
    r.raise_for_status()
    return r.json()
```

**`backend/sequencer.py`** — picks due enrollments and sends next step.

```python
# Run on schedule (every 10 min). Render cron jobs OR Render Background Worker.
def tick(supabase_client):
    """For every active enrollment with next_send_at <= now, send next step."""
    due = supabase_client.from_("lead_enrollments").select("*, leads(*), email_sequences(*)") \
        .eq("status", "active").lte("next_send_at", "now()").limit(20).execute()
    for enr in due.data:
        try:
            _send_next_step(supabase_client, enr)
        except Exception as e:
            # Log but don't crash the batch
            log_outreach(supabase_client, enr["lead_id"], "email", "outbound",
                         outcome="error", body=str(e))
```

Use the **service role key** (not anon) for server-side writes — bypasses
RLS. Set `SUPABASE_SERVICE_ROLE_KEY` in Render env.

**`backend/main.py`** new endpoints:

```python
@app.post("/api/admin/sequences/{lead_id}/enroll")
async def enroll_lead(lead_id: str, sequence_id: str = Form(...), x_admin_key: str = Header(...)):
    """Manual enrollment from the admin UI. x_admin_key authenticates the admin
    using the service role pattern — see _check_admin() below."""
    ...

@app.post("/api/admin/sequences/tick")
async def tick_endpoint(x_admin_key: str = Header(...)):
    """Triggered by Render cron every 10 min. Returns count of emails sent."""
    ...

# Resend webhook for opens/clicks/bounces
@app.post("/api/webhooks/resend")
async def resend_webhook(req: Request):
    payload = await req.json()
    # Resend signs webhooks — verify signature with RESEND_WEBHOOK_SECRET
    # Event types: email.sent, email.delivered, email.opened, email.clicked,
    #              email.bounced, email.complained
    ...

# Inbound mail webhook (for replies)
@app.post("/api/webhooks/resend-inbound")
async def resend_inbound(req: Request):
    """Set up an inbound route in Resend dashboard pointing here.
    Mark enrollment as 'replied', move lead status to 'replied',
    insert outreach_log row with the reply body."""
    ...
```

### Frontend additions

- **`src/admin/SequenceList.jsx`** — list/edit email sequences and steps.
  Markdown-style preview of templates with `{{lead.X}}` substitution.
- **`src/admin/EnrollButton.jsx`** in `LeadDrawer` — "Enroll in sequence"
  button + dropdown of active sequences.
- **`src/admin/AdminApp.jsx`** — add a tab/nav for "Sequences" alongside the
  existing pipeline view.

### Compliance (Stage 2)

- **CAN-SPAM**: every email needs (a) physical mailing address, (b) clear
  unsubscribe link or one-click instruction. Unsubscribes must be honored
  within 10 business days. Build an `/api/unsubscribe?token=...` endpoint
  that flips `lead_enrollments.status = 'unsubscribed'` and stop ALL future
  email to that address.
- Resend has built-in unsubscribe link insertion — enable it.
- Don't send to anyone who hasn't consented OR who you don't have a
  legitimate business relationship with. Cold-emailing scraped lists is a
  gray area — talk to a lawyer if you scale past hundreds/day.

### Cron / scheduling

Render has built-in cron jobs. Add a "Cron Job" service in Render dashboard:
- **Command**: `curl -X POST -H "X-Admin-Key: $ADMIN_API_KEY" https://payscope-jgoa.onrender.com/api/admin/sequences/tick`
- **Schedule**: `*/10 * * * *` (every 10 minutes)

---

## Stage 3: Demo magic links

### Goal
After a lead expresses interest (replied / asked for a demo), generate a
signed URL that gives them 7-day read-only access to a Payscope dashboard
populated with **synthetic data plausible for their specialty/state** (so
they can experience the product without uploading their own claims).

### Decisions made
- **No new auth user for demos.** Generate a JWT-style token with
  `lead_id`, `expires_at`, `purpose: 'demo'`. Token is a URL param.
- **Backend stores no demo session.** All needed state is in the token
  itself (signed, tamper-resistant) — verified per request.
- **Demo data is synthetic, generated on-the-fly** based on the lead's
  specialty (use existing `benchmarks.py` distributions). No real claims
  uploaded. ChatPanel disabled in demo mode (would cost OpenAI tokens per
  prospect).

### Decisions still open
- **What can the demo user actually do?** Likely: see the dashboard with
  pre-loaded data, but can't upload their own files, can't access settings.
  Show a banner: "Demo · Sign up for a $50/mo account to use your real data".
- **Tracking**: log every demo URL hit to `outreach_log` so we know which
  prospects opened the demo and how long they spent.

### Schema changes

```sql
-- demo_invites: minimal — token is signed so we don't strictly NEED a row
-- but we want to track which leads have been sent demos and what they did
create table if not exists public.demo_invites (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  token_hash text not null unique,           -- sha256 of issued token
  expires_at timestamptz not null,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  open_count int not null default 0,
  signup_completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.demo_invites enable row level security;
create policy admin_only_demo on public.demo_invites for all
  using (public.is_payscope_admin()) with check (public.is_payscope_admin());

-- Public RPC for incrementing open count (called from frontend with anon key)
create or replace function public.record_demo_open(token_hash_input text)
returns void language plpgsql security definer as $$
begin
  update public.demo_invites
  set open_count = open_count + 1,
      last_opened_at = now(),
      first_opened_at = coalesce(first_opened_at, now())
  where token_hash = token_hash_input
    and expires_at > now();
end;
$$;
grant execute on function public.record_demo_open(text) to anon;
```

### Backend additions

**`backend/demo.py`**:

```python
import os, hmac, hashlib, base64, json, time

DEMO_SECRET = os.getenv("DEMO_TOKEN_SECRET", "change-me-in-prod")

def issue_token(lead_id: str, ttl_seconds: int = 7 * 24 * 3600) -> str:
    payload = {"lid": lead_id, "exp": int(time.time()) + ttl_seconds}
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    sig = hmac.new(DEMO_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()[:16]
    return f"{body}.{sig}"

def verify_token(token: str) -> dict | None:
    try:
        body, sig = token.split(".")
        expected = hmac.new(DEMO_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()[:16]
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(body + "==="))
        if payload["exp"] < time.time():
            return None
        return payload
    except Exception:
        return None
```

**`backend/main.py`**:

```python
@app.post("/api/admin/leads/{lead_id}/issue-demo")
def issue_demo(lead_id: str):
    # check admin auth
    token = issue_token(lead_id)
    # store hash in demo_invites
    # return URL: f"https://payscope-two.vercel.app/demo?t={token}"
    ...
```

### Frontend additions

- **`src/main.jsx`** — pathname check: if `/demo`, render `<DemoApp />`
  with token from URL.
- **`src/demo/DemoApp.jsx`** — verifies token via backend, fetches generated
  sample analysis (use `benchmarks.py` data + the existing `MOCK_*` data
  from `DashboardPreview.jsx`), renders the same dashboard components in
  read-only mode. Banner at top: "Demo expires in N days · Sign up to use
  your real data" with sticky CTA button.
- Disable: upload zone, contracts panel, profile menu, chat panel input.

---

## Stage 4: Stripe billing

### Goal
Convert demo users / signed-up users to paying subscribers ($50/mo). Gate
the "use your own data" features behind an active subscription.

### Decisions made
- **Stripe.** No sane alternative. Create a Stripe Checkout session for the
  $50/mo subscription, redirect, listen for `checkout.session.completed`
  webhook to flip user's plan.

### Decisions still open
- **Free trial?** 14-day free trial after demo? Or just paid from day 1?
- **Gating** — what's free vs paid?
  - Recommendation: free signup gives access to landing/marketing only;
    uploading claims and viewing dashboard requires active subscription.
- **Annual plan?** Discount for annual upfront ($500/yr = ~17% off)?

### Schema changes

```sql
-- Track subscription state per Supabase auth user
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null,                      -- active | past_due | canceled | trialing | incomplete
  plan text not null default 'monthly',      -- monthly | annual
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Users can read their own subscription
create policy own_subscription on public.subscriptions for select
  using (auth.uid() = user_id);
-- Only service role writes (via webhook handler)
```

### Backend additions

**`backend/billing.py`** — Stripe wrapper.

```python
import os, stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
PRICE_ID_MONTHLY = os.getenv("STRIPE_PRICE_MONTHLY")  # price_xxx from Stripe dashboard

def create_checkout_session(user_email: str, supabase_user_id: str) -> str:
    s = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": PRICE_ID_MONTHLY, "quantity": 1}],
        customer_email=user_email,
        client_reference_id=supabase_user_id,
        success_url="https://payscope-two.vercel.app/?subscribed=true",
        cancel_url="https://payscope-two.vercel.app/?canceled=true",
        subscription_data={"trial_period_days": 14},  # if you decide to do trial
    )
    return s.url
```

**`backend/main.py`**:

```python
@app.post("/api/billing/checkout")
async def billing_checkout(req: Request):
    # require auth header from frontend (Supabase JWT)
    user = _require_user(req)
    return {"url": create_checkout_session(user["email"], user["id"])}

@app.post("/api/webhooks/stripe")
async def stripe_webhook(req: Request):
    payload = await req.body()
    sig = req.headers.get("stripe-signature")
    event = stripe.Webhook.construct_event(payload, sig, os.getenv("STRIPE_WEBHOOK_SECRET"))
    if event["type"] == "checkout.session.completed":
        # upsert subscriptions row
        ...
    elif event["type"] in ("customer.subscription.updated", "customer.subscription.deleted"):
        # update status / current_period_end
        ...
    return {"received": True}
```

### Frontend additions

- **`src/billing/`** new folder.
- **`src/billing/useSubscription.js`** — hook that fetches the current user's
  subscription row from Supabase. Cache in context.
- **`src/billing/PaywallModal.jsx`** — overlay shown when an unsubscribed
  user tries to upload claims.
- Update `App.jsx` so the "upload" view checks `useSubscription()` before
  rendering `<UploadZone>`. If `status !== 'active'` and not in trial, show
  the paywall + "Start trial / Subscribe" CTA that hits `/api/billing/checkout`.

### Stripe setup (manual, one-time)

1. Create Stripe account, get test + live keys.
2. Create a Product "Payscope" with a Price: $50 USD / month recurring.
3. In Stripe dashboard → Webhooks → add endpoint pointing to
   `https://payscope-jgoa.onrender.com/api/webhooks/stripe`.
   Subscribe to: `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`.
4. Add to Render env: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`,
   `STRIPE_WEBHOOK_SECRET`.

---

## Stage 5: AI calling (ElevenLabs + Twilio)

### Goal
For leads that don't reply to email, place an outbound AI-voice call. Have
a short conversation — qualify the practice, offer a demo, schedule a
follow-up. Capture transcript and outcome.

### Decisions made
- **ElevenLabs Conversational AI** for the agent (handles ASR + TTS + LLM
  in one product, optimized for low-latency phone conversation).
- **Twilio** for the actual phone calls. ElevenLabs has a Twilio integration
  documented at https://elevenlabs.io/docs/conversational-ai/integrations/twilio.

### Decisions still open
- **Voice agent script & persona** — needs a system prompt defining: who
  the agent is ("I'm an automated assistant from Payscope"), what they're
  calling about, what success looks like (book a demo? get an email?), how
  to handle objections, **mandatory AI disclosure** at start of call (legal
  requirement in CA, FL, TX — others coming).
- **Time-of-day rules** — no calls before 8am or after 9pm in the lead's
  timezone (TCPA requirement). Need timezone lookup from `leads.state`
  (rough mapping is fine).
- **DNC list** — must scrub against the National Do Not Call Registry.
  Practical impact for B2B is mixed (DNC mostly for residential), but worth
  building in.

### Schema changes

```sql
-- Add per-lead call eligibility / DNC flag
alter table public.leads
  add column if not exists do_not_call boolean not null default false,
  add column if not exists best_call_window text;  -- 'morning'|'afternoon'|'evening'

-- Calls already log to outreach_log (channel='call'). Add structured fields:
alter table public.outreach_log
  add column if not exists duration_seconds int,
  add column if not exists transcript_url text,
  add column if not exists recording_url text,
  add column if not exists provider_call_id text;  -- Twilio CallSid
```

### Backend additions

**`backend/voice.py`** — ElevenLabs + Twilio wrapper.

```python
import os, requests
from twilio.rest import Client as TwilioClient

ELEVEN_AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID")
ELEVEN_API_KEY = os.getenv("ELEVENLABS_API_KEY")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER")
twilio = TwilioClient(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))

def initiate_call(lead: dict) -> dict:
    """Place outbound call. ElevenLabs picks up via TwiML webhook."""
    twiml_url = f"https://payscope-jgoa.onrender.com/api/voice/twiml?lead_id={lead['id']}"
    call = twilio.calls.create(
        to=lead["phone"],
        from_=TWILIO_FROM_NUMBER,
        url=twiml_url,
        status_callback=f"https://payscope-jgoa.onrender.com/api/voice/status",
        status_callback_event=["initiated", "answered", "completed"],
        record=True,  # consent disclosure required in some states
    )
    return {"sid": call.sid, "status": call.status}
```

**`backend/main.py`**:

```python
@app.post("/api/admin/leads/{lead_id}/call")
async def trigger_call(lead_id: str, ...):
    """Admin-initiated call. Reject if do_not_call OR outside call window."""
    ...

@app.api_route("/api/voice/twiml", methods=["GET", "POST"])
def voice_twiml(lead_id: str):
    """Twilio fetches this when call connects. Return TwiML that hands the
    conversation to ElevenLabs Conversational AI agent.

    See: https://elevenlabs.io/docs/conversational-ai/integrations/twilio
    Example response uses <Connect><Stream> to ElevenLabs websocket.
    """
    ...

@app.post("/api/voice/status")
async def voice_status(req: Request):
    """Twilio callbacks: initiated/answered/completed.
    Insert/update outreach_log row with duration, recording URL."""
    ...

@app.post("/api/webhooks/elevenlabs")
async def elevenlabs_webhook(req: Request):
    """ElevenLabs posts conversation summary + transcript when call ends."""
    ...
```

### Frontend additions

- **`src/admin/CallButton.jsx`** in `LeadDrawer` — "📞 Call now" button
  (admin only). Disabled if no phone, do_not_call flag, or outside business
  hours.
- **`src/admin/CallTranscriptViewer.jsx`** — render transcript inline in
  outreach history.

### Compliance (Stage 5) — read this carefully

This is the highest-risk stage. The legal landscape:

1. **TCPA (federal)**: Calling a *residence* with an autodialer or
   pre-recorded voice requires prior express written consent. B2B numbers
   (medical practice main lines) are generally exempt from the consent
   requirement, **but** state laws are stricter.
2. **State AI disclosure laws**:
   - **CA AB 2655** (2024): must disclose AI agents in conversations.
   - **FL HB 919** (2024): similar.
   - **TX, IL** — pending.
   - Practical rule: agent's first sentence MUST be something like *"Hi, this
     is an automated assistant from Payscope. Is now a good time to talk
     about reducing claim underpayments?"*
3. **Recording consent**: 11 states are two-party consent (CA, FL, IL, MD,
   MA, MT, NH, PA, WA, etc.). If recording, agent must disclose: *"This
   call may be recorded for quality."* If lead is in a two-party state and
   doesn't consent, stop recording.
4. **DNC**: scrub against the National Do Not Call Registry quarterly. Not
   strictly required for B2B but defensible practice.
5. **Calling hours**: 8am-9pm in lead's local time. Use `leads.state` →
   timezone map.

**Recommendation**: write all this into the agent's system prompt + add
hard-coded checks in `initiate_call()` that refuse if any rule is violated.

### Twilio + ElevenLabs setup (manual)

1. Twilio: buy a phone number (~$1.15/mo), get account SID + auth token.
   Set `TWILIO_*` env vars on Render.
2. ElevenLabs: create a Conversational AI agent in the dashboard. Configure
   voice, system prompt, knowledge base (paste sample call scripts).
   Set `ELEVENLABS_AGENT_ID` + `ELEVENLABS_API_KEY` on Render.
3. Wire up the Twilio Stream → ElevenLabs websocket per the integration
   docs above.

Costs to plan for:
- Twilio: ~$0.013/min per outbound call (US)
- ElevenLabs Conversational AI: ~$0.10-0.30/min depending on plan
- All-in: ~$0.20-0.40 per minute of conversation

---

## Cross-cutting: admin metrics dashboard

After Stage 2, add a "Metrics" tab to `AdminApp.jsx`:

- **Funnel**: leads → emailed → opened → replied → demo → won
- **Cohort conversion** by source / specialty / state
- **MRR** (after Stage 4)
- **Per-channel ROI**: emails sent, calls placed, replies, demos, conversions

Use `recharts` (already a dep) for visualizations. Backend should expose
`GET /api/admin/metrics?from=YYYY-MM-DD&to=YYYY-MM-DD` returning aggregated
counts.

---

## Open questions to ask the human before building Stage 2

1. **Lead source** — manual entry only for now, or build a CSV importer?
   Long-term: NPI registry sync, web scraping, or buy a list?
2. **Email content tone** — formal medical-business, or casual founder-style?
3. **Trial period** — 14-day free trial after demo, or paid immediately?
4. **Annual discount** — yes/no?
5. **Calling hours strategy** — strict (only 9am-5pm local) or aggressive
   (8am-9pm)?
6. **Personalization budget** — willing to spend ~$0.05/email for LLM-rewrite,
   or strict templates only?

---

## File tree summary (after all stages built)

```
backend/
├── main.py                  # routing only
├── analyzer.py              # ✓ existing
├── benchmarks.py            # ✓ existing
├── contracts.py             # ✓ existing
├── ai.py                    # ✓ existing
├── chat.py                  # ✓ existing
├── llm.py                   # ✓ existing
├── email_sender.py          # NEW Stage 2
├── sequencer.py             # NEW Stage 2
├── demo.py                  # NEW Stage 3
├── billing.py               # NEW Stage 4
└── voice.py                 # NEW Stage 5

frontend/src/
├── App.jsx                  # ✓ + paywall hook (Stage 4)
├── main.jsx                 # ✓ + /demo path (Stage 3)
├── admin/
│   ├── AdminApp.jsx         # ✓ + Sequences + Metrics tabs
│   ├── LeadDrawer.jsx       # ✓ + EnrollButton + CallButton
│   ├── api.js               # ✓ + sequence/billing/call helpers
│   ├── config.js            # ✓
│   ├── SequenceList.jsx     # NEW Stage 2
│   ├── EnrollButton.jsx     # NEW Stage 2
│   ├── CallButton.jsx       # NEW Stage 5
│   ├── CallTranscriptViewer.jsx  # NEW Stage 5
│   └── MetricsDashboard.jsx # NEW (after Stage 2)
├── demo/
│   └── DemoApp.jsx          # NEW Stage 3
├── billing/
│   ├── useSubscription.js   # NEW Stage 4
│   └── PaywallModal.jsx     # NEW Stage 4
└── (existing components untouched)

supabase/migrations/
├── 20260509180408_admin_leads.sql       # ✓
├── <ts>_email_sequences.sql             # NEW Stage 2
├── <ts>_demo_invites.sql                # NEW Stage 3
├── <ts>_subscriptions.sql               # NEW Stage 4
└── <ts>_call_metadata.sql               # NEW Stage 5
```

---

## Environment variables checklist

| Var | Where | Stage |
|---|---|---|
| `OPENAI_API_KEY` | Render | ✓ |
| `OPENROUTER_API_KEY` | Render (fallback) | ✓ |
| `RESEND_API_KEY` | Render + supabase config push | ✓ |
| `SUPABASE_URL` | Render | needed for backend service-role writes |
| `SUPABASE_SERVICE_ROLE_KEY` | Render | Stage 2 (sequencer writes) |
| `ADMIN_API_KEY` | Render + Render cron | Stage 2 (cron auth) |
| `RESEND_WEBHOOK_SECRET` | Render | Stage 2 |
| `DEMO_TOKEN_SECRET` | Render | Stage 3 |
| `STRIPE_SECRET_KEY` | Render | Stage 4 |
| `STRIPE_PRICE_MONTHLY` | Render | Stage 4 |
| `STRIPE_WEBHOOK_SECRET` | Render | Stage 4 |
| `TWILIO_ACCOUNT_SID` | Render | Stage 5 |
| `TWILIO_AUTH_TOKEN` | Render | Stage 5 |
| `TWILIO_FROM_NUMBER` | Render | Stage 5 |
| `ELEVENLABS_API_KEY` | Render | Stage 5 |
| `ELEVENLABS_AGENT_ID` | Render | Stage 5 |
| `VITE_API_URL` | Vercel | ✓ |
| `VITE_SUPABASE_URL` | Vercel | ✓ |
| `VITE_SUPABASE_ANON_KEY` | Vercel | ✓ |

---

## How to verify the admin scaffold (already built)

```bash
# 1. Start servers (from project root)
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000 &
cd frontend && npm run dev &

# 2. Sign up at http://localhost:5173 with maxp68034@gmail.com (or whichever
#    email is in ADMIN_EMAILS in src/admin/config.js AND is_payscope_admin()
#    in the migration)

# 3. Visit http://localhost:5173/admin — pipeline should render

# 4. Confirm RLS works: log in as a different email, hit /admin → access denied
```

Production: same flow at `https://payscope-two.vercel.app/admin`. Vercel
rewrite (`frontend/vercel.json`) already routes the path to the SPA.
