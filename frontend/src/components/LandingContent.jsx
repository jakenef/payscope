import { useState } from 'react'

const STATS = [
  { value: '$47K', label: 'avg. recovered per practice in year one' },
  { value: '94%',  label: 'of underpaid claims caught within 30 days' },
  { value: '2 hrs', label: 'saved per week on billing reviews' },
]

const FEATURES = [
  {
    num: '01',
    title: 'Reimbursement Comparison',
    body: 'See what you typically get paid for each code — and flag anything that falls short. Never wonder if a claim was paid correctly again.',
  },
  {
    num: '02',
    title: 'Missing Claim Alerts',
    body: 'Payscope automatically flags claims that were underpaid, denied, or never paid. No more money falling through the cracks.',
  },
  {
    num: '03',
    title: 'Biller Scorecard',
    body: 'Get a data-driven performance score for your billing company — collection rate, denial rate, days to payment, and more.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Upload Your Claims',
    body: 'Import from your EHR or upload a CSV of submitted claims. No software integration required.',
  },
  {
    n: '02',
    title: 'Automatic Comparison',
    body: 'Payscope compares each claim against what that payer typically pays you for the same code — surfacing inconsistencies in your own data.',
  },
  {
    n: '03',
    title: 'Act & Hold Accountable',
    body: 'Review your dashboard, act on flagged issues, and hold your billing company accountable with hard data.',
  },
]

const PLANS = [
  {
    name: 'Payscope',
    price: '$50',
    desc: 'Everything you need to audit your billing — one flat price.',
    features: [
      'Unlimited claims uploads',
      'Self-referential peer baseline analysis',
      'AI-powered narrative + chat',
      'Biller scorecard',
      'CSV & Excel imports',
      'No data retention',
    ],
    cta: 'Get started',
    highlight: true,
  },
]

const FAQS = [
  {
    q: 'How does Payscope get my payment data?',
    a: 'You upload a CSV export from your practice management system or EHR. Payscope never connects directly to external systems — you control exactly what you share.',
  },
  {
    q: 'Do I need to switch billing companies?',
    a: "No — Payscope works with any billing company. It's an independent layer of oversight, not a replacement for your current biller.",
  },
  {
    q: 'Is my patient data safe?',
    a: 'Payscope analyzes claim-level financial data only. No patient identifiers are required. Data is processed in memory and never retained after your session.',
  },
  {
    q: 'What if I find a problem with my billing company?',
    a: 'Your Payscope report gives you hard evidence — underpayment amounts, denial rates, and recovery opportunities — to have a data-driven conversation with your biller or explore alternatives.',
  },
]

function SectionLabel({ children }) {
  return (
    <p style={{
      fontFamily: 'var(--font-sans)',
      fontSize: '0.62rem',
      fontWeight: 600,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--primary)',
      marginBottom: '12px',
    }}>
      {children}
    </p>
  )
}

function SectionHeading({ children }) {
  return (
    <h2 style={{
      fontFamily: 'var(--font-serif)',
      fontSize: '1.75rem',
      color: 'var(--text-bright)',
      fontWeight: 400,
      lineHeight: 1.25,
      marginBottom: '36px',
    }}>
      {children}
    </h2>
  )
}

export default function LandingContent({ onPlanCta }) {
  const [openFaq, setOpenFaq] = useState(null)

  return (
    <div style={{ width: '100%', marginTop: '56px' }}>

      {/* ── Stats Strip ─────────────────────────────── */}
      <div style={{
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: '40px 0 36px',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        marginBottom: '72px',
      }}>
        {STATS.map(({ value, label }, i) => (
          <div key={i} style={{
            textAlign: 'center',
            padding: '0 32px',
            borderRight: i < 2 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '2.6rem',
              fontWeight: 500,
              color: 'var(--primary-light)',
              lineHeight: 1,
              marginBottom: '14px',
              letterSpacing: '-0.02em',
            }}>
              {value}
            </div>
            <div style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              lineHeight: 1.55,
              maxWidth: '170px',
              margin: '0 auto',
            }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Features ────────────────────────────────── */}
      <div style={{ marginBottom: '72px' }}>
        <div style={{ textAlign: 'center' }}>
          <SectionLabel>Built for doctors who want answers — not excuses</SectionLabel>
          <SectionHeading>
            Three ways Payscope turns<br />billing chaos into clarity.
          </SectionHeading>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {FEATURES.map(({ num, title, body }) => (
            <div key={num} className="panel">
              <div className="panel-header">
                {title}
                <span className="panel-tag">{num}</span>
              </div>
              <div style={{ padding: '20px 16px' }}>
                <p style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.8rem',
                  color: 'var(--text)',
                  lineHeight: 1.75,
                }}>
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── How It Works ────────────────────────────── */}
      <div style={{ marginBottom: '72px' }}>
        <div style={{ textAlign: 'center' }}>
          <SectionLabel>How Payscope Works</SectionLabel>
          <SectionHeading>
            Three steps from blind spot<br />to bottom-line clarity.
          </SectionHeading>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0', position: 'relative' }}>
          {/* connector line between the step bubbles */}
          <div style={{
            position: 'absolute',
            top: '27px',
            left: '22%',
            right: '22%',
            height: '1px',
            background: 'linear-gradient(to right, transparent, var(--border-mid) 20%, var(--border-mid) 80%, transparent)',
            pointerEvents: 'none',
          }} />
          {STEPS.map(({ n, title, body }) => (
            <div key={n} style={{ padding: '0 28px', textAlign: 'center' }}>
              <div style={{
                width: '54px',
                height: '54px',
                border: '1px solid var(--border-mid)',
                background: 'var(--bg-panel)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                position: 'relative',
                zIndex: 1,
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  color: 'var(--primary-light)',
                  letterSpacing: '0.04em',
                }}>
                  {n}
                </span>
              </div>
              <div style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--text-bright)',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                marginBottom: '10px',
              }}>
                {title}
              </div>
              <p style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                lineHeight: 1.65,
              }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pricing + FAQ side-by-side ─────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)',
        gap: '48px',
        marginBottom: '80px',
        alignItems: 'start',
      }}>

      {/* Pricing column */}
      <div>
        <div>
          <SectionLabel>Simple, transparent pricing</SectionLabel>
          <SectionHeading>
            One plan. One price.<br />Pays for itself on the first audit.
          </SectionHeading>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ width: '100%', maxWidth: '380px' }}>
          {PLANS.map(({ name, price, badge, desc, features, cta, highlight }) => (
            <div key={name} className="panel" style={{
              border: `1px solid ${highlight ? 'var(--primary)' : 'var(--border)'}`,
              overflow: 'hidden',
            }}>
              {badge && (
                <div style={{
                  background: 'var(--primary)',
                  color: 'rgba(0,0,0,0.82)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '3px 0',
                  textAlign: 'center',
                }}>
                  {badge}
                </div>
              )}

              {/* card header */}
              <div style={{
                padding: '16px 16px 12px',
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: highlight ? 'var(--primary-light)' : 'var(--text-muted)',
                  marginBottom: '8px',
                }}>
                  {name}
                </div>
                <div>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '2.1rem',
                    color: highlight ? 'var(--primary-light)' : 'var(--text-bright)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                  }}>
                    {price}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    marginLeft: '4px',
                  }}>
                    /mo
                  </span>
                </div>
                <p style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  marginTop: '8px',
                  lineHeight: 1.5,
                }}>
                  {desc}
                </p>
              </div>

              {/* features + cta */}
              <div style={{ padding: '16px' }}>
                <ul style={{ listStyle: 'none', marginBottom: '16px' }}>
                  {features.map((f) => (
                    <li key={f} style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.75rem',
                      color: 'var(--text)',
                      padding: '5px 0',
                      borderBottom: '1px solid var(--text-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span style={{ color: 'var(--primary)', fontSize: '0.45rem', lineHeight: 1, flexShrink: 0 }}>◆</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className="btn"
                  onClick={() => onPlanCta?.(name)}
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    padding: '8px 14px',
                    background: highlight ? 'rgba(42,157,143,0.12)' : 'transparent',
                    borderColor: highlight ? 'var(--primary)' : 'var(--border-mid)',
                    color: highlight ? 'var(--primary-light)' : 'var(--text-bright)',
                  }}
                >
                  {cta}
                </button>
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* FAQ column */}
      <div>
        <div>
          <SectionLabel>Frequently asked questions</SectionLabel>
          <SectionHeading>
            Everything independent practices ask before getting started.
          </SectionHeading>
        </div>
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {FAQS.map(({ q, a }, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '16px 0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '20px',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  color: openFaq === i ? 'var(--primary-light)' : 'var(--text-bright)',
                  transition: 'color 0.15s',
                }}>
                  {q}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.1rem',
                  color: 'var(--primary)',
                  flexShrink: 0,
                  lineHeight: 1,
                  display: 'inline-block',
                  transition: 'transform 0.2s',
                  transform: openFaq === i ? 'rotate(45deg)' : 'none',
                }}>
                  +
                </span>
              </button>
              {openFaq === i && (
                <div style={{ paddingBottom: '16px' }}>
                  <p style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.75,
                  }}>
                    {a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      </div>
      {/* end pricing+faq grid */}

    </div>
  )
}
