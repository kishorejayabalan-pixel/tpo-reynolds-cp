"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import Link from "next/link";
import {
  Download,
  Printer,
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Shield,
  BarChart3,
  AlertTriangle,
} from "lucide-react";

interface ReportPayload {
  period: string;
  objective: string;
  topScenario: {
    allocation: Record<string, number>;
    incMargin: number;
    incUnits: number;
    roi: number;
    riskScore: number;
    confidenceScore: number;
  };
  top5Scenarios: Array<{
    allocation: Record<string, number>;
    incMargin: number;
    roi: number;
    riskScore: number;
    confidenceScore: number;
  }>;
  baseAllocation: Array<{ retailerName: string; spend: number }>;
  recommendedAllocation: Record<string, number>;
  deltasVsBase: Record<string, number>;
  explanationBullets: string[];
  dataGapNote: string | null;
  allScenariosCount: number;
  runtimeMs: number;
}

export default function ReportPage() {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("conversationId") ?? "";
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["optimization", conversationId || "latest"],
    queryFn: async () => {
      const url = conversationId
        ? `/api/optimization?conversationId=${conversationId}`
        : "/api/optimization";
      const res = await fetch(url);
      const j = await res.json();
      if (!j.run?.payload) return null;
      return j.run.payload as ReportPayload;
    },
    enabled: true,
  });

  const handleExport = useCallback(() => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tpo-report-${data.period}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [data]);

  const handlePrint = useCallback(() => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>TPO Summary Report</title>
      <style>
        body{font-family:system-ui;padding:24px;max-width:800px;margin:0 auto}
        h1{font-size:1.5rem}
        table{width:100%;border-collapse:collapse;margin:1em 0}
        th,td{border:1px solid #ddd;padding:8px;text-align:left}
        .kpi{display:flex;gap:16px;flex-wrap:wrap;margin:1em 0}
        .kpi-item{background:#f5f5f5;padding:12px;min-width:120px}
        .bullets{list-style:disc;padding-left:24px}
        .note{background:#fff3cd;padding:12px;margin:1em 0;border-radius:8px}
      </style></head><body>
      ${printRef.current.innerHTML}
      </body></html>
    `);
    w.document.close();
    w.print();
    w.close();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <p className="text-slate-600">Loading report…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Optimizer
        </Link>
        <p className="text-slate-600">
          No optimization run found. Run one from the optimizer first, then click &quot;View Summary Report&quot; or visit /report.
        </p>
      </div>
    );
  }

  const top = data.topScenario;
  const baseByName = Object.fromEntries(
    data.baseAllocation.map((b) => [b.retailerName, b.spend])
  );

  const headline = `Reallocate ${Math.abs(
    Object.values(data.deltasVsBase)
      .filter((d) => d < 0)
      .reduce((a, b) => a + b, 0) / 1_000_000
  ).toFixed(1)}M from Club channels to Walmart/Mass for +$${(top.incMargin / 1_000_000).toFixed(1)}M margin impact`;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto" ref={printRef}>
        <div className="flex items-center justify-between mb-8 print:hidden">
          <Link
            href={`/?conversationId=${conversationId}`}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Optimizer
          </Link>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          TPO Summary Report
        </h1>
        <p className="text-slate-600 text-sm mb-6">
          {data.period} • {data.objective.replace("_", " ")} • {data.allScenariosCount} scenarios
          evaluated in {data.runtimeMs}ms
        </p>

        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Recommendation
          </h2>
          <p className="text-slate-800">{headline}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">Incremental Margin</p>
            <p className="text-xl font-bold text-emerald-600">
              ${(top.incMargin / 1_000_000).toFixed(1)}M
            </p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">ROI</p>
            <p className="text-xl font-bold text-blue-600">
              {(top.roi * 100).toFixed(1)}%
            </p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">Units</p>
            <p className="text-xl font-bold text-slate-800">
              {(top.incUnits / 1_000).toFixed(1)}K
            </p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">Confidence</p>
            <p className="text-xl font-bold text-slate-800">
              {(top.confidenceScore * 100).toFixed(0)}%
            </p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">Risk</p>
            <p className="text-xl font-bold text-slate-800">
              {(top.riskScore * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">Allocation Delta (Base vs Recommended)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b">
                <th className="text-left py-2">Retailer</th>
                <th className="text-right py-2">Base ($M)</th>
                <th className="text-right py-2">Recommended ($M)</th>
                <th className="text-right py-2">Delta</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(top.allocation).map(([name, spend]) => {
                const base = baseByName[name] ?? 0;
                const delta = data.deltasVsBase[name] ?? 0;
                return (
                  <tr key={name} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">{name}</td>
                    <td className="text-right py-2 font-medium text-slate-900">{(base / 1_000_000).toFixed(2)}</td>
                    <td className="text-right py-2 font-medium text-slate-900">{(spend / 1_000_000).toFixed(2)}</td>
                    <td className={`text-right py-2 font-medium ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-slate-900"}`}>
                      {delta > 0 ? "+" : ""}{(delta / 1_000_000).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">Top 5 Scenarios</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b">
                <th className="text-left py-2">#</th>
                <th className="text-right py-2">Inc Margin ($M)</th>
                <th className="text-right py-2">ROI %</th>
                <th className="text-right py-2">Confidence</th>
                <th className="text-right py-2">Risk</th>
              </tr>
            </thead>
            <tbody>
              {data.top5Scenarios.map((s, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-900">{i + 1}</td>
                  <td className="text-right py-2 font-medium text-slate-900">{(s.incMargin / 1_000_000).toFixed(2)}</td>
                  <td className="text-right py-2 font-medium text-slate-900">{(s.roi * 100).toFixed(1)}</td>
                  <td className="text-right py-2 font-medium text-slate-900">{(s.confidenceScore * 100).toFixed(0)}%</td>
                  <td className="text-right py-2 font-medium text-slate-900">{(s.riskScore * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.explanationBullets?.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-2">Why this recommendation</h3>
            <ul className="list-disc list-inside text-slate-700 space-y-1">
              {data.explanationBullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}

        {data.dataGapNote && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Data Coverage Note</p>
              <p className="text-sm text-amber-800/90 mt-1">{data.dataGapNote}</p>
            </div>
          </div>
        )}

        <div className="mt-6 text-sm text-slate-500">
          {data.allScenariosCount} scenarios evaluated • {data.runtimeMs}ms runtime • Seed 42 (reproducible)
        </div>
      </div>
    </div>
  );
}
