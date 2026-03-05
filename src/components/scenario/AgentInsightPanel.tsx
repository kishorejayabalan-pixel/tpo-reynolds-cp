"use client";

export interface AgentInsightData {
  signalSummary?: string[];
  tradeOffMatrix?: { metric: string; before: number; after: number; delta: number }[];
  whyThisPlan?: string;
  confidence?: { p10Revenue?: number; p50Revenue?: number; p90Revenue?: number };
}

export default function AgentInsightPanel({ data }: { data: AgentInsightData | null }) {
  if (!data) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
        <h3 className="font-semibold text-slate-200 mb-2">Agent Intelligence</h3>
        <p className="text-slate-500 text-sm">No agent reasoning for this scenario.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/50">
        <h3 className="font-semibold text-slate-200">Agent Intelligence</h3>
      </div>
      <div className="p-4 space-y-4">
        {data.signalSummary && data.signalSummary.length > 0 && (
          <section>
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
              Signal Summary
            </h4>
            <ul className="space-y-1 text-sm text-slate-300">
              {data.signalSummary.map((s, i) => (
                <li key={i}>• {s}</li>
              ))}
            </ul>
          </section>
        )}

        {data.tradeOffMatrix && data.tradeOffMatrix.length > 0 && (
          <section>
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
              Trade-Off Matrix
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="text-left py-1 pr-2">Metric</th>
                    <th className="text-right py-1 px-2">Before</th>
                    <th className="text-right py-1 px-2">After</th>
                    <th className="text-right py-1 px-2">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tradeOffMatrix.map((row, i) => (
                    <tr key={i} className="border-t border-slate-700/30">
                      <td className="py-1 pr-2 text-slate-300">{row.metric}</td>
                      <td className="text-right py-1 px-2 text-slate-400">{formatNum(row.before)}</td>
                      <td className="text-right py-1 px-2 text-slate-400">{formatNum(row.after)}</td>
                      <td
                        className={`text-right py-1 px-2 font-medium ${row.delta >= 0 ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {row.delta >= 0 ? "+" : ""}{formatNum(row.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {data.whyThisPlan && (
          <section>
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
              Why This Plan?
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">{data.whyThisPlan}</p>
          </section>
        )}

        {data.confidence && (data.confidence.p10Revenue != null || data.confidence.p50Revenue != null) && (
          <section>
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
              Confidence & Risk Bands
            </h4>
            <div className="flex gap-4 text-sm">
              {data.confidence.p10Revenue != null && (
                <span className="text-slate-400">
                  P10 revenue: <span className="text-slate-200">${(data.confidence.p10Revenue / 1e6).toFixed(2)}M</span>
                </span>
              )}
              {data.confidence.p50Revenue != null && (
                <span className="text-slate-400">
                  P50 revenue: <span className="text-slate-200">${(data.confidence.p50Revenue / 1e6).toFixed(2)}M</span>
                </span>
              )}
              {data.confidence.p90Revenue != null && (
                <span className="text-slate-400">
                  P90 revenue: <span className="text-slate-200">${(data.confidence.p90Revenue / 1e6).toFixed(2)}M</span>
                </span>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(2);
}
