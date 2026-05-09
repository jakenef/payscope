import { useState } from 'react'

function pctColor(pct) {
  if (pct < 65) return '#e05252'
  if (pct < 85) return '#f0a050'
  return '#52b788'
}

const baseHeaders = [
  { key: 'cpt',               label: 'CPT' },
  { key: 'payer',             label: 'Payer' },
  { key: 'charged',           label: 'Charged' },
  { key: 'paid',              label: 'Paid' },
  { key: 'medicare_expected', label: 'Medicare' },
  { key: 'downcode_pct',      label: 'Paid / Billed' },
  { key: 'medicare_pct',      label: 'Paid / MCR' },
  { key: 'medicare_gap',      label: 'Gap' },
]
const contractHeaders = [
  { key: 'contracted_expected', label: 'Contracted' },
  { key: 'contracted_pct',      label: 'Paid / Ctr' },
]

const fmt = (n) => n == null ? '—' : `$${Number(n).toFixed(2)}`

export default function UnderpaymentTable({ rows }) {
  const [sortKey, setSortKey] = useState('medicare_gap')
  const [sortDir, setSortDir] = useState(1)

  const hasContractData = rows.some((r) => r.contracted_expected != null)
  const headers = hasContractData ? [...baseHeaders, ...contractHeaders] : baseHeaders

  const toggle = (key) => {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(1) }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return (av - bv) * sortDir
  })

  return (
    <div className="panel">
      <div className="panel-header">
        Flagged Claims — {rows.length} records
        <span className="panel-tag">Click column to sort</span>
      </div>
      <div style={{ padding: '12px 16px', overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {headers.map(h => (
                <th key={h.key} onClick={() => toggle(h.key)}>
                  {h.label}
                  {sortKey === h.key && (
                    <span style={{ marginLeft: '4px', color: 'var(--primary-light)' }}>
                      {sortDir === 1 ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i}>
                <td style={{ color: 'var(--primary-light)', fontWeight: 500 }}>{row.cpt}</td>
                <td style={{ color: 'var(--text-bright)', fontFamily: 'var(--font-sans)', fontSize: '0.75rem' }}>{row.payer}</td>
                <td style={{ color: 'var(--text-muted)' }}>{fmt(row.charged)}</td>
                <td style={{ color: 'var(--text)' }}>{fmt(row.paid)}</td>
                <td style={{ color: 'var(--text-muted)' }}>{fmt(row.medicare_expected)}</td>
                <td style={{ color: pctColor(row.downcode_pct), fontWeight: 500 }}>{row.downcode_pct}%</td>
                <td style={{ color: pctColor(row.medicare_pct), fontWeight: 500 }}>{row.medicare_pct}%</td>
                <td style={{ color: '#e05252', fontWeight: 600 }}>{fmt(row.medicare_gap)}</td>
                {hasContractData && (
                  <>
                    <td style={{ color: 'var(--text-muted)' }}>{fmt(row.contracted_expected)}</td>
                    <td style={{
                      color: row.contracted_pct == null ? 'var(--text-dim)' : pctColor(row.contracted_pct),
                      fontWeight: 500,
                    }}>
                      {row.contracted_pct == null ? '—' : `${row.contracted_pct}%`}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
