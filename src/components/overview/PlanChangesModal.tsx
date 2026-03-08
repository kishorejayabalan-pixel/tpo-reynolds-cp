"use client";

import { useEffect } from "react";

interface DecisionEntry {
  id: string;
  createdAt: string;
  agent: string;
  action: string;
  reason: string;
  beforeKpi: Record<string, unknown> | null;
  afterKpi: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  explanation: string | null;
}

interface PlanChangesModalProps {
  entry: DecisionEntry | null;
  onClose: () => void;
}

export default function PlanChangesModal({ entry, onClose }: PlanChangesModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!entry) return null;

  const before = entry.beforeKpi ?? {};
  const after = entry.afterKpi ?? {};
  const diff = entry.diff ?? {};
  const kpiKeys = ["revenue", "margin", "spend", "roi", "risk"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="rounded-xl border border-slate-700 bg-slate-900 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-slate-200">Plan Changes (Full Diff)</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div>
            <h4 className="text-slate-400 text-sm font-medium mb-2">KPI delta</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-700">
                  <th className="py-2 pr-4">Metric</th>
                  <th className="py-2 pr-4">Before</th>
                  <th className="py-2 pr-4">After</th>
                  <th className="py-2">Δ</th>
                </tr>
              </thead>
              <tbody>
                {kpiKeys.map((k) => {
                  const b = Number(before[k]) ?? 0;
                  const a = Number(after[k]) ?? 0;
                  const delta = a - b;
                  const format = (v: number) =>
                    k === "roi" || k === "risk"
                      ? k === "risk"
                        ? `${(v * 100).toFixed(0)}%`
                        : v.toFixed(2)
                      : `$${(v / 1e6).toFixed(2)} Million`;
                  return (
                    <tr key={k} className="border-b border-slate-700/50">
                      <td className="py-2 pr-4 text-slate-300 capitalize">{k}</td>
                      <td className="py-2 pr-4 text-slate-400">{format(b)}</td>
                      <td className="py-2 pr-4 text-slate-200">{format(a)}</td>
                      <td className={`py-2 ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {delta >= 0 ? "+" : ""}
                        {k === "roi" || k === "risk" ? (k === "risk" ? `${(delta * 100).toFixed(0)}%` : delta.toFixed(2)) : `${(delta / 1e6).toFixed(2)} Million`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {Object.keys(diff).length > 0 && (
            <div>
              <h4 className="text-slate-400 text-sm font-medium mb-2">Changed fields</h4>
              <pre className="rounded bg-slate-800 p-3 text-xs text-slate-300 overflow-auto max-h-40">
                {JSON.stringify(diff, null, 2)}
              </pre>
            </div>
          )}
          {entry.explanation && (
            <div>
              <h4 className="text-slate-400 text-sm font-medium mb-2">Explanation</h4>
              <p className="text-slate-300 text-sm">{entry.explanation}</p>
            </div>
          )}
          <p className="text-slate-500 text-xs">
            Changed cells grid (SKU × Week) and changed promotions table would be populated from decision payload when available.
          </p>
        </div>
      </div>
    </div>
  );
}
