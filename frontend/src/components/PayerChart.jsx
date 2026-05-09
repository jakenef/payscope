import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

function barColor(pct) {
  if (pct < -25) return '#e05252'
  if (pct < -10) return '#f0a050'
  if (pct < 0)   return '#3ab8a8'
  return '#52b788'
}

const CustomBar = (props) => {
  const { x, y, width, height, payload } = props
  return <rect x={x} y={y} width={width} height={height} rx={2} fill={barColor(payload.variance_pct)} />
}

export default function PayerChart({ payers }) {
  const data = [...payers].sort((a, b) => a.variance_pct - b.variance_pct)

  return (
    <div className="panel">
      <div className="panel-header">
        Payer Variance
        <span className="panel-tag">% delta</span>
      </div>
      <div style={{ padding: '12px 16px 8px' }}>
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 44)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#1e3a44" horizontal={false} />
            <ReferenceLine x={0} stroke="#255a68" strokeWidth={1} />
            <XAxis
              type="number"
              tickFormatter={v => `${v}%`}
              tick={{ fill: '#527888', fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              dataKey="payer"
              type="category"
              tick={{ fill: '#b4d0d8', fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}
              width={80} axisLine={false} tickLine={false}
            />
            <Tooltip
              formatter={(v) => [`${v}%`, 'vs. your typical rate']}
              contentStyle={{
                background: '#122830',
                border: '1px solid #1e4a55',
                borderRadius: 0,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.72rem',
                color: '#b4d0d8',
              }}
              labelStyle={{ color: '#3ab8a8', fontWeight: 600 }}
              cursor={{ fill: 'rgba(42,157,143,0.05)' }}
            />
            <Bar dataKey="variance_pct" shape={<CustomBar />} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
