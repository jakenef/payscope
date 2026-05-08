import { useState } from 'react'

function pctColor(pct) {
  if (pct < 65) return 'text-red-400 font-semibold'
  if (pct < 85) return 'text-amber-400'
  return 'text-emerald-400'
}

export default function UnderpaymentTable({ rows }) {
  const [sortKey, setSortKey] = useState('medicare_gap')
  const [sortDir, setSortDir] = useState(1)

  const toggle = (key) => {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(1) }
  }

  const sorted = [...rows].sort((a, b) => (a[sortKey] - b[sortKey]) * sortDir)

  const headers = [
    { key: 'cpt',          label: 'CPT' },
    { key: 'payer',        label: 'Payer' },
    { key: 'charged',      label: 'Charged' },
    { key: 'paid',         label: 'Paid' },
    { key: 'medicare_expected', label: 'Medicare' },
    { key: 'downcode_pct', label: 'Paid/Billed' },
    { key: 'medicare_pct', label: 'Paid/Medicare' },
    { key: 'medicare_gap', label: 'Gap $' },
  ]

  const fmt = (n) => `$${Number(n).toFixed(2)}`

  return (
    <div className="bg-slate-800/50 rounded-2xl p-4 overflow-x-auto">
      <h3 className="text-slate-300 text-sm font-semibold uppercase tracking-widest mb-3">
        Flagged Claims — {rows.length} rows
      </h3>
      <table className="w-full text-sm text-left">
        <thead>
          <tr>
            {headers.map(h => (
              <th
                key={h.key}
                onClick={() => toggle(h.key)}
                className="pb-2 pr-4 text-slate-400 text-xs font-medium cursor-pointer hover:text-slate-200 whitespace-nowrap"
              >
                {h.label} {sortKey === h.key ? (sortDir === 1 ? '↑' : '↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-t border-slate-700/40 hover:bg-slate-700/20">
              <td className="py-2 pr-4 text-blue-300 font-mono">{row.cpt}</td>
              <td className="py-2 pr-4 text-slate-300">{row.payer}</td>
              <td className="py-2 pr-4 text-slate-400">{fmt(row.charged)}</td>
              <td className="py-2 pr-4 text-slate-300">{fmt(row.paid)}</td>
              <td className="py-2 pr-4 text-slate-400">{fmt(row.medicare_expected)}</td>
              <td className={`py-2 pr-4 ${pctColor(row.downcode_pct)}`}>{row.downcode_pct}%</td>
              <td className={`py-2 pr-4 ${pctColor(row.medicare_pct)}`}>{row.medicare_pct}%</td>
              <td className="py-2 text-red-400 font-semibold">{fmt(row.medicare_gap)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
