import AuditScoreHero from './AuditScoreHero'
import InfoPanel from './InfoPanel'
import NarrativePanel from './NarrativePanel'
import UnderpaymentTable from './UnderpaymentTable'
import BenchmarkPanel from './BenchmarkPanel'

const MOCK_SUMMARY = {
  biller_score: 60,
  total_charged: 197643,
  total_peer_expected: 82438,
  total_paid: 69993,
  leakage_dollars: 12446,
  leakage_pct: 15.1,
  total_claims: 600,
  flagged_claims: 597,
  date_range: 'Jan 2024 – Jun 2024',
}

const MOCK_NARRATIVE =
  "MOLINA and WELLPOINT are underpaying significantly — paying 46% and 55% of your typical rate for the same procedures. " +
  "Submucous resection (30140) and septoplasty (30520) show the worst gaps, suggesting a documentation or modifier issue " +
  "specific to those procedures. Three actions: (1) audit the last 30 days of MOLINA claims for missing modifiers, " +
  "(2) request a fee schedule review with WELLPOINT — they're paying well below what other payers pay for the same codes, " +
  "(3) flag 30140 and 30520 for prior-auth review going forward."

const MOCK_BENCHMARKS = {
  specialty: 'ENT',
  state: 'CA',
  cohort_size: 47,
  metrics: [
    {
      key: 'biller_score', label: 'Biller score',
      user: 60, p25: 60.14, median: 70.81, p75: 81.48,
      higher_is_better: true, unit: '', percentile: 23,
    },
    {
      key: 'leakage_pct', label: 'Revenue leakage',
      user: 15.1, p25: 4.62, median: 9.35, p75: 16.28,
      higher_is_better: false, unit: '%', percentile: 28,
    },
    {
      key: 'payment_ratio_pct', label: 'Collection Rate',
      user: 84.9, p25: 82.42, median: 89.18, p75: 94.28,
      higher_is_better: true, unit: '%', percentile: 35,
    },
  ],
}

const MOCK_FLAGGED = [
  { cpt: '30520', payer: 'ANTHEM',    charged: 893.22,  paid: 233.39, peer_expected: 563.26, downcode_pct: 26.1, peer_pct: 41.4, peer_gap: -329.87 },
  { cpt: '30140', payer: 'WELLPOINT', charged: 731.49,  paid: 128.51, peer_expected: 394.93, downcode_pct: 17.6, peer_pct: 32.5, peer_gap: -266.42 },
  { cpt: '30140', payer: 'ANTHEM',    charged: 724.63,  paid: 158.04, peer_expected: 394.93, downcode_pct: 21.8, peer_pct: 40.0, peer_gap: -236.89 },
  { cpt: '30140', payer: 'ANTHEM',    charged: 528.35,  paid: 159.68, peer_expected: 394.93, downcode_pct: 30.2, peer_pct: 40.4, peer_gap: -235.25 },
  { cpt: '30520', payer: 'HUMANA',    charged: 892.05,  paid: 359.78, peer_expected: 563.26, downcode_pct: 40.3, peer_pct: 63.9, peer_gap: -203.48 },
  { cpt: '60220', payer: 'ANTHEM',    charged: 996.81,  paid: 518.10, peer_expected: 714.47, downcode_pct: 52.0, peer_pct: 72.5, peer_gap: -196.37 },
  { cpt: '60220', payer: 'ANTHEM',    charged: 1184.11, paid: 528.05, peer_expected: 714.47, downcode_pct: 44.6, peer_pct: 73.9, peer_gap: -186.42 },
  { cpt: '30520', payer: 'ANTHEM',    charged: 837.26,  paid: 409.22, peer_expected: 563.26, downcode_pct: 48.9, peer_pct: 72.7, peer_gap: -154.04 },
  { cpt: '60220', payer: 'KAISER',    charged: 1200.44, paid: 582.14, peer_expected: 714.47, downcode_pct: 48.5, peer_pct: 81.5, peer_gap: -132.33 },
]

const MOCK_PROMPTS = [
  'Which payer is hurting us most?',
  'What CPT codes are most underpaid?',
  'Give me 3 actions to fix the top issue.',
]

/**
 * MockChatSidebar — static visual approximation of ChatPanel for the preview.
 * Shows the suggested prompts, no live submission.
 */
function MockChatSidebar() {
  return (
    <div className="panel" style={{
      width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column',
      minHeight: '100%',
    }}>
      <div className="panel-header">
        <span>Ask Payscope</span>
        <span className="panel-tag">grounded in your data</span>
      </div>
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{
          fontSize: '0.62rem', fontWeight: 500,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--text-muted)', marginBottom: '4px',
        }}>
          Try asking
        </div>
        {MOCK_PROMPTS.map((p) => (
          <div key={p} style={{
            fontFamily: 'var(--font-sans)', fontSize: '0.78rem',
            color: 'var(--text-bright)',
            background: 'var(--bg-panel-alt)',
            border: '1px solid var(--border)',
            padding: '8px 10px',
          }}>
            {p}
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 'auto',
        padding: '10px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: '8px',
      }}>
        <div style={{
          flex: 1,
          background: 'var(--bg-dark)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
          padding: '7px 10px',
          fontFamily: 'var(--font-sans)', fontSize: '0.78rem',
        }}>
          Ask about your data...
        </div>
        <div className="btn" style={{ pointerEvents: 'none' }}>Send</div>
      </div>
    </div>
  )
}

export default function DashboardPreview() {
  return (
    <div style={{
      position: 'relative',
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-mid)',
      padding: '14px',
      boxShadow:
        '0 30px 60px -20px rgba(0, 0, 0, 0.55), 0 8px 24px -8px rgba(42, 157, 143, 0.18)',
      textAlign: 'left',
      overflow: 'hidden',
    }}>
      {/* fake browser-style header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 4px 12px',
        borderBottom: '1px solid var(--border)',
        marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{
            fontFamily: 'var(--font-serif)', fontSize: '1.05rem',
            color: 'var(--text-bright)',
          }}>
            Payscope
          </span>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: '0.55rem',
            fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--primary)',
          }}>
            Revenue Integrity
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          fontFamily: 'var(--font-sans)', fontSize: '0.62rem',
          color: 'var(--green)',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#52b788' }} />
          Complete
        </div>
      </div>

      {/* the dashboard itself */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <AuditScoreHero summary={MOCK_SUMMARY} />
        <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch' }}>
          <InfoPanel summary={MOCK_SUMMARY} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <NarrativePanel narrative={MOCK_NARRATIVE} />
            <BenchmarkPanel benchmarks={MOCK_BENCHMARKS} />
            <UnderpaymentTable rows={MOCK_FLAGGED} />
          </div>
          <MockChatSidebar />
        </div>
      </div>

      {/* sample data caption */}
      <div style={{
        marginTop: '12px', textAlign: 'center',
        fontFamily: 'var(--font-sans)', fontSize: '0.6rem',
        fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--text-muted)',
      }}>
        Live preview · sample data from a 600-claim ENT practice in CA
      </div>
    </div>
  )
}
