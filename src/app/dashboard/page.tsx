"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { ArrowLeft, BarChart3, LayoutGrid, Loader2 } from "lucide-react";

const CHART_COLORS = {
  revenue: "#14b8a6",
  margin: "#22c55e",
  spend: "#f97316",
  TPR: "#3b82f6",
  BOGO: "#22c55e",
  Display: "#f97316",
  Feature: "#a855f7",
  Seasonal: "#ec4899",
  Clearance: "#64748b",
};

interface ScenarioRow {
  id: string;
  name: string;
  status: string;
  kpiSummary: Record<string, unknown> | null;
  updatedAt: string;
}

interface ChartsData {
  revenueTrend: { week: string; revenue: number; margin: number }[];
  spendByMechanic: { week: string; TPR?: number; BOGO?: number; Display?: number; Feature?: number; Seasonal?: number; Clearance?: number }[];
  roiVsSpend: { promoEventId: string; skuName: string; promoType: string; roi: number; spend: number; margin: number }[];
  categoryMix: { category: string; revenue: number; spend: number; margin: number }[];
}

export default function DashboardChartsPage() {
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [scenarioId, setScenarioId] = useState<string>("");
  const [retailerId, setRetailerId] = useState<string>("");
  const [chartsData, setChartsData] = useState<ChartsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);

  const fetchScenarios = useCallback(async () => {
    try {
      const res = await fetch("/api/scenarios/workspace");
      const data = await res.json();
      const list = (data.scenarios ?? []).slice(0, 8);
      setScenarios(list);
      if (!scenarioId && list.length) setScenarioId(list[0].id);
    } finally {
      setLoading(false);
    }
  }, [scenarioId]);

  const fetchCharts = useCallback(async () => {
    if (!scenarioId) {
      setChartsData(null);
      setChartsLoading(false);
      return;
    }
    setChartsLoading(true);
    try {
      const params = new URLSearchParams({ scenarioId, weeks: "12" });
      if (retailerId) params.set("retailerId", retailerId);
      const res = await fetch(`/api/dashboard/charts?${params}`);
      const data = await res.json();
      setChartsData(data);
    } finally {
      setChartsLoading(false);
    }
  }, [scenarioId, retailerId]);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  const kpi = (s: ScenarioRow, key: string): number | string => {
    const v = (s.kpiSummary as Record<string, unknown>)?.[key];
    if (v == null) return "—";
    if (key === "revenue" || key === "spend" || key === "margin") return `$${Number(v) / 1e6}M`;
    if (key === "roi") return Number(v).toFixed(2);
    if (key === "risk") return `${(Number(v) * 100).toFixed(0)}%`;
    return String(v);
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="w-56 flex-shrink-0 bg-slate-900/95 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Image src="/rcp-logo.svg" alt="Reynolds CP" width={28} height={28} className="object-contain invert" />
            <div>
              <p className="font-semibold text-sm">Reynolds CP</p>
              <p className="text-xs text-slate-500">TPO Suite</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          <Link
            href="/"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Overview
          </Link>
          <Link
            href="/dashboard"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
          >
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/scenarios"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            <LayoutGrid className="h-4 w-4" />
            Scenario Workspace
          </Link>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 p-6">
        <header className="flex-shrink-0 flex items-center gap-4 mb-6">
          <h1 className="text-xl font-semibold text-slate-200">Performance Trends</h1>
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            className="rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">Select scenario…</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <span className="text-slate-500 text-sm">Retailer (optional):</span>
          <input
            type="text"
            value={retailerId}
            onChange={(e) => setRetailerId(e.target.value)}
            placeholder="Retailer ID"
            className="rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 w-40"
          />
        </header>

        {/* Scenarios table (top 8) */}
        <section className="flex-shrink-0 rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 mb-6">
          <h2 className="font-semibold text-slate-200 mb-3">Scenarios</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700/50">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Revenue</th>
                    <th className="py-2 pr-4">ROI</th>
                    <th className="py-2 pr-4">Spend</th>
                    <th className="py-2">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-slate-700/30 hover:bg-slate-800/50 cursor-pointer"
                      onClick={() => (window.location.href = `/scenarios?scenarioId=${s.id}`)}
                    >
                      <td className="py-2.5 pr-4 font-medium text-slate-200">{s.name}</td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.status === "AGENT_GENERATED" ? "bg-violet-500/20 text-violet-300" : "bg-slate-600/50 text-slate-400"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-teal-400">{kpi(s, "revenue")}</td>
                      <td className="py-2.5 pr-4 text-slate-300">{kpi(s, "roi")}</td>
                      <td className="py-2.5 pr-4 text-amber-400">{kpi(s, "spend")}</td>
                      <td className="py-2.5 text-red-400">{kpi(s, "risk")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Performance Trends – 4 charts */}
        <section className="flex-1 min-h-0 space-y-6">
          {chartsLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-500"><Loader2 className="h-8 w-8 animate-spin" /> Loading charts…</div>
          ) : chartsData ? (
            <>
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 h-72">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Revenue & Margin trend</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={chartsData.revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} />
                    <Tooltip formatter={(v: number) => [`$${(Number(v) / 1e6).toFixed(2)}M`, ""]} contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke={CHART_COLORS.revenue} name="Revenue" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="margin" stroke={CHART_COLORS.margin} name="Margin" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 h-72">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Spend by mechanic (stacked)</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <AreaChart data={chartsData.spendByMechanic}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${(v / 1e3).toFixed(0)}K`} />
                    <Tooltip formatter={(v: number) => [`$${(Number(v) / 1e3).toFixed(1)}K`, ""]} contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} />
                    <Legend />
                    <Area type="monotone" dataKey="TPR" stackId="1" stroke={CHART_COLORS.TPR} fill={CHART_COLORS.TPR} fillOpacity={0.8} name="TPR" />
                    <Area type="monotone" dataKey="BOGO" stackId="1" stroke={CHART_COLORS.BOGO} fill={CHART_COLORS.BOGO} fillOpacity={0.8} name="BOGO" />
                    <Area type="monotone" dataKey="Display" stackId="1" stroke={CHART_COLORS.Display} fill={CHART_COLORS.Display} fillOpacity={0.8} name="Display" />
                    <Area type="monotone" dataKey="Feature" stackId="1" stroke={CHART_COLORS.Feature} fill={CHART_COLORS.Feature} fillOpacity={0.8} name="Feature" />
                    <Area type="monotone" dataKey="Seasonal" stackId="1" stroke={CHART_COLORS.Seasonal} fill={CHART_COLORS.Seasonal} fillOpacity={0.8} name="Seasonal" />
                    <Area type="monotone" dataKey="Clearance" stackId="1" stroke={CHART_COLORS.Clearance} fill={CHART_COLORS.Clearance} fillOpacity={0.8} name="Clearance" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 h-72">
                <h3 className="text-sm font-medium text-slate-300 mb-2">ROI vs Spend (by event)</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                    <CartesianGrid stroke="#334155" />
                    <XAxis type="number" dataKey="spend" name="Spend" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${(v / 1e3).toFixed(0)}K`} />
                    <YAxis type="number" dataKey="roi" name="ROI" stroke="#94a3b8" fontSize={11} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} formatter={(v: number) => [v]} />
                    <Legend />
                    {["TPR", "BOGO", "Display", "Feature", "Seasonal", "Clearance", "None"].map((mechanic) => (
                      <Scatter
                        key={mechanic}
                        name={mechanic}
                        data={chartsData.roiVsSpend.filter((d) => (d.promoType || "None") === mechanic)}
                        fill={(CHART_COLORS as Record<string, string>)[mechanic] ?? "#64748b"}
                      />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 h-72">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Category mix (Revenue, Spend, Margin)</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <ComposedChart data={chartsData.categoryMix} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 80 }}>
                    <CartesianGrid stroke="#334155" />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} />
                    <YAxis type="category" dataKey="category" stroke="#94a3b8" fontSize={11} width={70} />
                    <Tooltip formatter={(v: number) => [`$${(Number(v) / 1e6).toFixed(2)}M`, ""]} contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} />
                    <Legend />
                    <Bar dataKey="revenue" fill={CHART_COLORS.revenue} name="Revenue" barSize={14} radius={[0, 2, 2, 0]} />
                    <Bar dataKey="spend" fill={CHART_COLORS.spend} name="Spend" barSize={14} radius={[0, 2, 2, 0]} />
                    <Bar dataKey="margin" fill={CHART_COLORS.margin} name="Margin" barSize={14} radius={[0, 2, 2, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <p className="text-slate-500">Select a scenario to load charts.</p>
          )}
        </section>
      </div>
    </div>
  );
}
