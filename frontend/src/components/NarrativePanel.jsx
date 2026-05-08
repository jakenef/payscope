export default function NarrativePanel({ narrative }) {
  if (!narrative) return null

  return (
    <div className="bg-indigo-950/60 border border-indigo-700/40 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-indigo-400 text-xs font-semibold uppercase tracking-widest">
          AI Analysis
        </span>
        <span className="text-slate-600 text-xs">· GPT-4o</span>
      </div>
      <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{narrative}</p>
    </div>
  )
}
