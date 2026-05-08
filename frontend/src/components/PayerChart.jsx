import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer
} from 'recharts'

function barColor(pct) {
  if (pct < -25) return '#ef4444'
  if (pct < -10) return '#f59e0b'
  return '#22c55e'
}

export default function PayerChart({ payers }) {
  const data = [...payers].sort((a, b) => a.variance_pct - b.variance_pct)

  return (
    <div className="bg-slate-800/50 rounded-2xl p-4">
      <h3 className="text-slate-300 text-sm font-semibold uppercase tracking-widest mb-3">
        Payer Variance vs Medicare
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 40)}>
        <BarChart data={data} layout="vertical" margin={{ left: 16, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={v => `${v}%`}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
          />
          <YAxis
            dataKey="payer"
            type="category"
            tick={{ fill: '#cbd5e1', fontSize: 12 }}
            width={72}
            axisLine={false}
          />
          <Tooltip
            formatter={(v) => [`${v}%`, 'Variance vs Medicare']}
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#f1f5f9' }}
          />
          <Bar dataKey="variance_pct" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={barColor(entry.variance_pct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
