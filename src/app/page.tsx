"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  AlertTriangle,
  ShieldAlert,
  Wallet,
  Zap,
  ChevronDown,
  ChevronUp,
  Play,
  Loader2,
  Cpu,
  CheckCircle2,
  XCircle,
  Settings,
  LayoutGrid,
  BarChart3,
} from "lucide-react";
import OverviewAgentConsole from "@/components/overview/OverviewAgentConsole";
import PlanChangesModal from "@/components/overview/PlanChangesModal";

const PERIOD = "2026-Q2";

interface Retailer {
  id: string;
  name: string;
}
interface Scenario {
  id: string;
  name: string;
  status: string;
  kpiSummary: Record<string, unknown> | null;
}
interface SignalRow {
  id: string;
  timestamp: string;
  type: string;
  retailerName: string;
  category: string;
  skuCode: string;
  weeks: number[];
  severity: number;
}
interface Recommendation {
  id: string;
  title: string;
  rationale: string;
  expectedImpact: { revenueDelta: number; roiDelta: number; spendDelta: number; riskDelta: number };
  actions: { simulate: boolean; apply: boolean; viewDiff: boolean };
}
interface Health {
  spendUsed: number;
  spendCap: number;
  spendUtilization: number;
  spendStatus: string;
  roiCurrent: number;
  roiFloor: number;
  roiStatus: string;
  riskCurrent: number;
  riskMax: number;
  riskStatus: string;
  topIssues: Array<{ sku: string; weeks: number[]; issueType: string; suggestedFix: string; confidence: number }>;
}
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

export default function OverviewCommandCenter() {
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedRetailerId, setSelectedRetailerId] = useState<string>("");
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [period, setPeriod] = useState(PERIOD);
  const [autopilotOn, setAutopilotOn] = useState(false);
  const [approvalMode, setApprovalMode] = useState<"SuggestOnly" | "AutoApplyUnderGuardrails" | "RequireApproval">("SuggestOnly");
  const [lastAgentRun, setLastAgentRun] = useState<string | null>(null);

  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [decisionLog, setDecisionLog] = useState<DecisionEntry[]>([]);
  const [runbookOpen, setRunbookOpen] = useState(false);
  const [runbook, setRunbook] = useState({
    guardrails: { roiFloor: 1.2, spendCap: 3_000_000, maxChangePerCycle: 0.1, stockoutMax: 0.15 },
    triggers: ["competitor_drop_5", "inventory_delay", "demand_spike"],
    frequencySeconds: 60,
  });
  const [planDiffModalOpen, setPlanDiffModalOpen] = useState(false);
  const [filterAlertSkuWeeks, setFilterAlertSkuWeeks] = useState<{ skus?: string[]; weeks?: number[] } | null>(null);

  const fetchRetailers = useCallback(async () => {
    const res = await fetch("/api/retailers");
    const data = await res.json();
    if (data.retailers?.length) {
      setRetailers(data.retailers);
      if (!selectedRetailerId) setSelectedRetailerId(data.retailers[0].id);
    }
  }, [selectedRetailerId]);

  const fetchScenarios = useCallback(async () => {
    const res = await fetch("/api/scenarios/workspace");
    const data = await res.json();
    if (data.scenarios?.length) {
      setScenarios(data.scenarios);
      const baseline = data.scenarios.find((s: Scenario) => s.name === "Baseline Plan");
      if (!selectedScenarioId && baseline) setSelectedScenarioId(baseline.id);
      else if (!selectedScenarioId && data.scenarios[0]) setSelectedScenarioId(data.scenarios[0].id);
    }
  }, [selectedScenarioId]);

  const fetchSignals = useCallback(async () => {
    const res = await fetch("/api/signals/latest?limit=12");
    const data = await res.json();
    if (data.signals) setSignals(data.signals);
  }, []);

  const fetchRecommendations = useCallback(async () => {
    const params = new URLSearchParams();
    if (selectedScenarioId) params.set("scenarioId", selectedScenarioId);
    if (selectedRetailerId) params.set("retailerId", selectedRetailerId);
    const res = await fetch(`/api/recommendations?${params}`);
    const data = await res.json();
    if (data.recommendations) setRecommendations(data.recommendations);
  }, [selectedScenarioId, selectedRetailerId]);

  const fetchHealth = useCallback(async () => {
    const params = new URLSearchParams();
    if (selectedScenarioId) params.set("scenarioId", selectedScenarioId);
    if (selectedRetailerId) params.set("retailerId", selectedRetailerId);
    const res = await fetch(`/api/overview/health?${params}`);
    const data = await res.json();
    if (!data.error) setHealth(data);
  }, [selectedScenarioId, selectedRetailerId]);

  const fetchDecisionLog = useCallback(async () => {
    const params = new URLSearchParams({ limit: "20" });
    if (selectedRetailerId) params.set("retailerId", selectedRetailerId);
    const res = await fetch(`/api/decision-log?${params}`);
    const data = await res.json();
    if (data.entries) {
      setDecisionLog(data.entries);
      if (data.entries[0]) setLastAgentRun(data.entries[0].createdAt);
    }
  }, [selectedRetailerId]);

  const fetchSettings = useCallback(async () => {
    if (!selectedRetailerId) return;
    const res = await fetch(`/api/overview/settings?retailerId=${selectedRetailerId}`);
    const data = await res.json();
    if (data.approvalMode) setApprovalMode(data.approvalMode);
    if (data.runbook) setRunbook((r) => ({ ...r, ...data.runbook }));
  }, [selectedRetailerId]);

  useEffect(() => {
    fetchRetailers();
    fetchScenarios();
  }, []);

  useEffect(() => {
    fetchSignals();
    fetchRecommendations();
    fetchHealth();
    fetchDecisionLog();
    fetchSettings();
    const t = setInterval(() => {
      fetchSignals();
      fetchRecommendations();
      fetchHealth();
      fetchDecisionLog();
    }, 15000);
    return () => clearInterval(t);
  }, [fetchSignals, fetchRecommendations, fetchHealth, fetchDecisionLog, fetchSettings, selectedScenarioId, selectedRetailerId]);

  const latestDecision = decisionLog[0] ?? null;
  const scenarioKpi = scenarios.find((s) => s.id === selectedScenarioId)?.kpiSummary as Record<string, unknown> | undefined;
  const topAlternatives = scenarios.filter((s) => s.id !== selectedScenarioId).slice(0, 3);

  const meterColor = (status: string) =>
    status === "safe" ? "bg-emerald-500" : status === "warning" ? "bg-amber-500" : "bg-red-500";

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
          <Link href="/" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <DollarSign className="h-4 w-4" />
            Overview
          </Link>
          <Link href="/dashboard" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </Link>
          <Link href="/scenarios" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800">
            <Calendar className="h-4 w-4" />
            Scenario Workspace
          </Link>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header strip */}
        <header className="flex-shrink-0 border-b border-slate-800 bg-slate-900/80 px-4 py-3 flex flex-wrap items-center gap-4">
          <span className="text-slate-500 text-sm">Scenario</span>
          <select
            value={selectedScenarioId}
            onChange={(e) => setSelectedScenarioId(e.target.value)}
            className="rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 min-w-[180px]"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <span className="text-slate-500 text-sm">Retailer</span>
          <select
            value={selectedRetailerId}
            onChange={(e) => setSelectedRetailerId(e.target.value)}
            className="rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 min-w-[140px]"
          >
            {retailers.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <span className="text-slate-500 text-sm">Period</span>
          <span className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200">{period}</span>
          <span className="text-slate-500 text-sm">Last Agent Run</span>
          <span className="text-slate-300 text-sm">
            {lastAgentRun ? new Date(lastAgentRun).toLocaleString() : "—"}
          </span>
          <button
            type="button"
            onClick={() => setAutopilotOn((o) => !o)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${autopilotOn ? "bg-amber-600 text-white" : "bg-slate-700 text-slate-300"}`}
          >
            <Zap className="h-4 w-4" />
            Autopilot {autopilotOn ? "ON" : "OFF"}
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-slate-500 text-xs">Approval</span>
            <select
              value={approvalMode}
              onChange={(e) => {
                const v = e.target.value as typeof approvalMode;
                setApprovalMode(v);
                if (selectedRetailerId) {
                  fetch(`/api/overview/settings`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ retailerId: selectedRetailerId, approvalMode: v }),
                  });
                }
              }}
              className="rounded-lg bg-slate-800 border border-slate-600 px-2 py-1.5 text-xs text-slate-200"
            >
              <option value="SuggestOnly">Suggest Only</option>
              <option value="AutoApplyUnderGuardrails">Auto-Apply Under Guardrails</option>
              <option value="RequireApproval">Require Approval</option>
            </select>
          </div>
        </header>

        <main className="flex-1 grid grid-cols-[minmax(280px,1fr)_minmax(320px,1.4fr)_minmax(300px,1fr)] gap-4 p-4 min-h-0 overflow-auto">
          {/* LEFT: Action Center */}
          <div className="flex flex-col gap-4 min-w-0">
            <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <h2 className="font-semibold text-slate-200">Live Alerts</h2>
              </div>
              <div className="max-h-48 overflow-auto p-2 space-y-1">
                {signals.length === 0 ? (
                  <p className="text-slate-500 text-sm p-2">No recent signals.</p>
                ) : (
                  signals.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFilterAlertSkuWeeks({ weeks: s.weeks?.length ? s.weeks : undefined })}
                      className="w-full text-left rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/40 p-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 text-xs">
                          {new Date(s.timestamp).toLocaleString()}
                        </span>
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            s.type === "competitor_drop"
                              ? "bg-red-500/20 text-red-300"
                              : s.type === "inventory_delay"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-violet-500/20 text-violet-300"
                          }`}
                        >
                          {s.type.replace("_", " ")}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 mt-1">
                        {s.retailerName !== "—" && `${s.retailerName} · `}
                        {s.category} {s.skuCode !== "—" && `· ${s.skuCode}`}
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-slate-500 text-xs">Severity</span>
                        <span className="text-slate-400 text-xs">{s.severity}/100</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-violet-400" />
                <h2 className="font-semibold text-slate-200">Agent Recommendations</h2>
              </div>
              <div className="max-h-64 overflow-auto p-2 space-y-2">
                {recommendations.length === 0 ? (
                  <p className="text-slate-500 text-sm p-2">No recommendations.</p>
                ) : (
                  recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3"
                    >
                      <p className="font-medium text-slate-200 text-sm">{rec.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{rec.rationale}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {rec.expectedImpact.revenueDelta !== 0 && (
                          <span className={rec.expectedImpact.revenueDelta > 0 ? "text-emerald-400" : "text-red-400"}>
                            {rec.expectedImpact.revenueDelta > 0 ? "+" : ""}
                            {(rec.expectedImpact.revenueDelta * 100).toFixed(0)}% Revenue
                          </span>
                        )}
                        {rec.expectedImpact.roiDelta !== 0 && (
                          <span className={rec.expectedImpact.roiDelta > 0 ? "text-emerald-400" : "text-red-400"}>
                            {rec.expectedImpact.roiDelta > 0 ? "+" : ""}ROI
                          </span>
                        )}
                        {rec.expectedImpact.spendDelta !== 0 && (
                          <span className="text-amber-400">
                            {rec.expectedImpact.spendDelta > 0 ? "+" : ""}
                            {(rec.expectedImpact.spendDelta * 100).toFixed(0)}% Spend
                          </span>
                        )}
                        {rec.expectedImpact.riskDelta !== 0 && (
                          <span className={rec.expectedImpact.riskDelta > 0 ? "text-red-400" : "text-emerald-400"}>
                            Risk {rec.expectedImpact.riskDelta > 0 ? "+" : ""}
                            {(rec.expectedImpact.riskDelta * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button type="button" className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600">
                          Simulate
                        </button>
                        <button type="button" className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500">
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlanDiffModalOpen(true)}
                          className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
                        >
                          View Diff
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* CENTER: Plan Health + Plan Changes */}
          <div className="flex flex-col gap-4 min-w-0">
            <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-emerald-400" />
                <h2 className="font-semibold text-slate-200">Plan Health</h2>
              </div>
              <div className="p-4 space-y-4">
                {health && (
                  <>
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Budget Utilization</span>
                        <span>{((health.spendUtilization ?? 0) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full ${meterColor(health.spendStatus ?? "safe")} transition-all`}
                          style={{ width: `${Math.min(100, (health.spendUtilization ?? 0) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>ROI vs floor ({health.roiFloor})</span>
                        <span>{(health.roiCurrent ?? 0).toFixed(2)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full ${meterColor(health.roiStatus ?? "safe")} transition-all`}
                          style={{ width: `${Math.min(100, ((health.roiCurrent ?? 0) / (health.roiFloor || 1)) * 50)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Stockout Risk vs max</span>
                        <span>{((health.riskCurrent ?? 0) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full ${meterColor(health.riskStatus ?? "safe")} transition-all`}
                          style={{ width: `${Math.min(100, ((health.riskCurrent ?? 0) / (health.riskMax || 0.15)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden flex-1 min-h-0 flex flex-col">
              <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <h2 className="font-semibold text-slate-200">Top Issues</h2>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-700/50">
                      <th className="py-2 px-3">SKU</th>
                      <th className="py-2 px-3">Week(s)</th>
                      <th className="py-2 px-3">Issue</th>
                      <th className="py-2 px-3">Suggested fix</th>
                      <th className="py-2 px-3">Conf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(health?.topIssues ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-slate-500 text-center">
                          No issues.
                        </td>
                      </tr>
                    ) : (
                      (health?.topIssues ?? []).map((issue, i) => (
                        <tr
                          key={i}
                          className="border-b border-slate-700/30 hover:bg-slate-800/50 cursor-pointer"
                          onClick={() => document.getElementById("plan-diff")?.scrollIntoView()}
                        >
                          <td className="py-2 px-3 text-slate-200">{issue.sku}</td>
                          <td className="py-2 px-3 text-slate-300">W{issue.weeks.join(", W")}</td>
                          <td className="py-2 px-3">
                            <span className="text-red-400/90">{issue.issueType}</span>
                          </td>
                          <td className="py-2 px-3 text-slate-400 text-xs">{issue.suggestedFix}</td>
                          <td className="py-2 px-3 text-slate-400">{(issue.confidence * 100).toFixed(0)}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="plan-diff" className="rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
                <h2 className="font-semibold text-slate-200">Plan Changes (Last Agent Run)</h2>
                <button
                  type="button"
                  onClick={() => setPlanDiffModalOpen(true)}
                  className="text-xs text-indigo-400 hover:underline"
                >
                  View full diff
                </button>
              </div>
              <div className="p-4">
                {!latestDecision ? (
                  <p className="text-slate-500 text-sm">No agent run yet.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-3">
                      <span>Promotions changed: —</span>
                      <span>Weeks affected: —</span>
                      <span>Budget moved: —</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {latestDecision.afterKpi?.revenue != null && (
                        <span className="rounded bg-emerald-500/20 text-emerald-300 px-2 py-1 text-xs">
                          Revenue ${(Number(latestDecision.afterKpi.revenue) / 1e6).toFixed(2)}M
                        </span>
                      )}
                      {latestDecision.afterKpi?.margin != null && (
                        <span className="rounded bg-emerald-500/20 text-emerald-300 px-2 py-1 text-xs">
                          Margin ${(Number(latestDecision.afterKpi.margin) / 1e6).toFixed(2)}M
                        </span>
                      )}
                      {latestDecision.afterKpi?.roi != null && (
                        <span className="rounded bg-violet-500/20 text-violet-300 px-2 py-1 text-xs">
                          ROI {Number(latestDecision.afterKpi.roi).toFixed(2)}
                        </span>
                      )}
                      {latestDecision.afterKpi?.risk != null && (
                        <span className="rounded bg-red-500/20 text-red-300 px-2 py-1 text-xs">
                          Risk {(Number(latestDecision.afterKpi.risk) * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {latestDecision.explanation && (
                      <p className="text-slate-400 text-xs mt-2">{latestDecision.explanation}</p>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT: Agent Console */}
          <div className="flex flex-col min-w-0">
            <OverviewAgentConsole
              scenarioId={selectedScenarioId}
              retailerId={selectedRetailerId}
              approvalMode={approvalMode}
              onRefresh={() => {
                fetchDecisionLog();
                fetchScenarios();
              }}
            />
          </div>
        </main>

        {/* Autopilot Runbook */}
        <section className="flex-shrink-0 border-t border-slate-800 mx-4 mt-2">
          <button
            type="button"
            onClick={() => setRunbookOpen((o) => !o)}
            className="w-full flex items-center justify-between py-3 text-left text-slate-300 hover:text-slate-200"
          >
            <span className="font-medium">Autopilot Runbook</span>
            {runbookOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {runbookOpen && (
            <div className="pb-4 grid grid-cols-3 gap-4 text-sm">
              <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
                <h4 className="text-slate-400 font-medium mb-2">Guardrails</h4>
                <ul className="text-slate-300 space-y-1 text-xs">
                  <li>ROI floor: {runbook.guardrails.roiFloor}</li>
                  <li>Spend cap: ${(runbook.guardrails.spendCap / 1e6).toFixed(1)}M</li>
                  <li>Max change/cycle: {(runbook.guardrails.maxChangePerCycle * 100).toFixed(0)}%</li>
                  <li>Stockout max: {(runbook.guardrails.stockoutMax * 100).toFixed(0)}%</li>
                </ul>
                <button type="button" className="mt-2 flex items-center gap-1 text-indigo-400 text-xs hover:underline">
                  <Settings className="h-3 w-3" />
                  Edit Guardrails
                </button>
              </div>
              <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
                <h4 className="text-slate-400 font-medium mb-2">Triggers</h4>
                <ul className="text-slate-300 space-y-1 text-xs">
                  {runbook.triggers.map((t, i) => (
                    <li key={i}>{t.replace(/_/g, " ")}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
                <h4 className="text-slate-400 font-medium mb-2">Frequency</h4>
                <p className="text-slate-300 text-xs">
                  Every {runbook.frequencySeconds === 30 ? "30s" : runbook.frequencySeconds === 60 ? "1m" : `${runbook.frequencySeconds}s`}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Scenario Spotlight */}
        <section className="flex-shrink-0 border-t border-slate-800 p-4 mt-2">
          <h3 className="font-semibold text-slate-200 mb-3">Scenario Spotlight</h3>
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4 min-w-[200px]">
              <p className="text-slate-500 text-xs mb-1">Current scenario</p>
              <p className="text-slate-200 font-medium">
                {scenarios.find((s) => s.id === selectedScenarioId)?.name ?? "—"}
              </p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {scenarioKpi?.revenue != null && (
                  <span className="text-teal-400 text-xs">${(Number(scenarioKpi.revenue) / 1e6).toFixed(2)}M</span>
                )}
                {scenarioKpi?.roi != null && (
                  <span className="text-violet-400 text-xs">ROI {Number(scenarioKpi.roi).toFixed(2)}</span>
                )}
                {scenarioKpi?.spend != null && (
                  <span className="text-amber-400 text-xs">${(Number(scenarioKpi.spend) / 1e6).toFixed(2)}M spend</span>
                )}
              </div>
            </div>
            {topAlternatives.map((s) => (
              <div key={s.id} className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-3 min-w-[160px]">
                <p className="text-slate-400 text-xs">{s.name}</p>
                <div className="flex gap-2 mt-1">
                  <Link
                    href={`/scenarios?scenarioId=${s.id}`}
                    className="text-xs text-indigo-400 hover:underline"
                  >
                    Open in Workspace
                  </Link>
                  <Link
                    href={`/scenarios?compare=${selectedScenarioId},${s.id}`}
                    className="text-xs text-slate-400 hover:underline"
                  >
                    Compare
                  </Link>
                </div>
              </div>
            ))}
            <Link
              href="/scenarios"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Open Scenario Workspace
            </Link>
            <button type="button" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600">
              Commit
            </button>
          </div>
        </section>
      </div>

      {planDiffModalOpen && (
        <PlanChangesModal
          entry={latestDecision}
          onClose={() => setPlanDiffModalOpen(false)}
        />
      )}
    </div>
  );
}
