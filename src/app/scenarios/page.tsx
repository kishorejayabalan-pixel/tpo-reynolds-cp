"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, ArrowLeft, Sparkles, Loader2, BarChart3 } from "lucide-react";
import ScenarioTabs from "@/components/scenario/ScenarioTabs";
import ScenarioWorkspace from "@/components/scenario/ScenarioWorkspace";
import GenerateAgentPlanModal from "@/components/scenario/GenerateAgentPlanModal";
import type { WorkspaceScenario } from "@/components/scenario/ScenarioTabs";
import type { PromoEventRow } from "@/components/scenario/ScenarioWorkspace";
import type { AgentInsightData } from "@/components/scenario/AgentInsightPanel";

export default function ScenarioWorkspacePage() {
  const searchParams = useSearchParams();
  const scenarioIdFromUrl = searchParams.get("scenarioId");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<WorkspaceScenario[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [scenarioDetail, setScenarioDetail] = useState<{
    promoEvents: PromoEventRow[];
    kpiSummary: Record<string, unknown> | null;
    name: string;
  } | null>(null);
  const [agentInsight, setAgentInsight] = useState<AgentInsightData | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareLeftId, setCompareLeftId] = useState<string | null>(null);
  const [compareRightId, setCompareRightId] = useState<string | null>(null);
  const [compareLeftKpi, setCompareLeftKpi] = useState<Record<string, unknown> | null>(null);
  const [compareRightKpi, setCompareRightKpi] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);
  const [generateAgentModalOpen, setGenerateAgentModalOpen] = useState(false);

  const fetchScenarioDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/scenarios/workspace/${id}`);
    const data = await res.json();
    if (data.scenario) {
      setScenarioDetail({
        name: data.scenario.name,
        kpiSummary: data.scenario.kpiSummary,
        promoEvents: data.scenario.promoEvents ?? [],
      });
      const k = data.scenario.kpiSummary;
      if (k && (k as Record<string, unknown>).explanation) {
        setAgentInsight({
          whyThisPlan: (k as Record<string, unknown>).explanation as string,
          tradeOffMatrix: [
            { metric: "Revenue", before: 0, after: (k as Record<string, unknown>).revenue as number ?? 0, delta: (k as Record<string, unknown>).revenue as number ?? 0 },
            { metric: "ROI", before: 1.0, after: (k as Record<string, unknown>).roi as number ?? 1.2, delta: ((k as Record<string, unknown>).roi as number ?? 1.2) - 1 },
            { metric: "Risk", before: 0.15, after: (k as Record<string, unknown>).risk as number ?? 0.1, delta: ((k as Record<string, unknown>).risk as number ?? 0.1) - 0.15 },
          ],
          signalSummary: ["Competitor drop at Kroger", "Demand spike W6–W7"],
          confidence: { p10Revenue: 8e6, p50Revenue: 10e6, p90Revenue: 12e6 },
        });
      } else {
        setAgentInsight(null);
      }
    } else {
      setScenarioDetail(null);
      setAgentInsight(null);
    }
  }, []);

  useEffect(() => {
    if (activeId) fetchScenarioDetail(activeId);
    else setScenarioDetail(null);
  }, [activeId, fetchScenarioDetail]);

  const fetchScenarios = useCallback(async () => {
    setScenariosLoading(true);
    try {
      const res = await fetch("/api/scenarios/workspace");
      const data = await res.json();
      if (data.scenarios) setScenarios(data.scenarios);
    } finally {
      setScenariosLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  // When URL has scenarioId or scenarios list loads, sync activeId
  useEffect(() => {
    const fromUrl = searchParams.get("scenarioId");
    const compareParam = searchParams.get("compare");
    if (compareParam) {
      const [id1, id2] = compareParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (id1 && id2) {
        setCompareMode(true);
        setCompareLeftId(id1);
        setCompareRightId(id2);
      }
    }
    if (fromUrl && scenarios.some((s) => s.id === fromUrl)) setActiveId(fromUrl);
    else if (!fromUrl && scenarios.length && activeId === null) setActiveId(scenarios[0].id);
  }, [scenarios, searchParams]);

  const handleNewScenario = useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/scenarios/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Scenario ${new Date().toLocaleDateString()}`, status: "DRAFT" }),
      });
      const data = await res.json();
      if (data.scenario) {
        setActiveId(data.scenario.id);
        await fetchScenarios();
      }
    } finally {
      setCreating(false);
    }
  }, [fetchScenarios]);

  const handleOpenGenerateAgentPlan = useCallback(() => {
    if (activeId) setGenerateAgentModalOpen(true);
  }, [activeId]);

  const handleAgentPlansGenerated = useCallback(
    async (scenarioIds: string[]) => {
      await fetchScenarios();
      if (scenarioIds.length) setActiveId(scenarioIds[0]);
      if (scenarioIds[0]) fetchScenarioDetail(scenarioIds[0]);
    },
    [fetchScenarios, fetchScenarioDetail]
  );

  useEffect(() => {
    if (compareMode && compareLeftId) {
      fetch(`/api/scenarios/workspace/${compareLeftId}`)
        .then((r) => r.json())
        .then((d) => d.scenario?.kpiSummary && setCompareLeftKpi(d.scenario.kpiSummary));
    } else setCompareLeftKpi(null);
  }, [compareMode, compareLeftId]);

  useEffect(() => {
    if (compareMode && compareRightId) {
      fetch(`/api/scenarios/workspace/${compareRightId}`)
        .then((r) => r.json())
        .then((d) => d.scenario?.kpiSummary && setCompareRightKpi(d.scenario.kpiSummary));
    } else setCompareRightKpi(null);
  }, [compareMode, compareRightId]);

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
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <LayoutGrid className="h-4 w-4" />
            Scenario Workspace
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <ScenarioTabs
          activeId={activeId}
          onSelect={setActiveId}
          onNewScenario={handleNewScenario}
          compareMode={compareMode}
          onToggleCompare={() => setCompareMode((c) => !c)}
          scenarios={scenarios}
          onScenariosChange={setScenarios}
          loading={scenariosLoading}
        >
          {compareMode ? (
            <div className="flex gap-4 p-4 overflow-auto">
              <div className="flex-1 rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
                <label className="block text-sm font-medium text-slate-400 mb-2">Scenario A</label>
                <select
                  value={compareLeftId ?? ""}
                  onChange={(e) => setCompareLeftId(e.target.value || null)}
                  className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-slate-200 mb-4"
                >
                  <option value="">Select…</option>
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {compareLeftKpi && (
                  <ul className="space-y-1 text-sm text-slate-300">
                    {["revenue", "margin", "roi", "spend", "risk"].map((k) => (
                      <li key={k}>{k}: {String(compareLeftKpi[k] ?? "—")}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex-1 rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
                <label className="block text-sm font-medium text-slate-400 mb-2">Scenario B</label>
                <select
                  value={compareRightId ?? ""}
                  onChange={(e) => setCompareRightId(e.target.value || null)}
                  className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-slate-200 mb-4"
                >
                  <option value="">Select…</option>
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {compareRightKpi && (
                  <ul className="space-y-1 text-sm text-slate-300">
                    {["revenue", "margin", "roi", "spend", "risk"].map((k) => (
                      <li key={k}>{k}: {String(compareRightKpi[k] ?? "—")}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="w-48 flex-shrink-0 rounded-xl border border-teal-500/50 bg-slate-900/40 p-4">
                <h4 className="text-sm font-medium text-slate-300 mb-2">Delta (B − A)</h4>
                {compareLeftKpi && compareRightKpi && (
                  <ul className="space-y-1 text-sm">
                    {(["revenue", "margin", "spend"] as const).map((k) => {
                      const a = Number(compareLeftKpi[k]) || 0;
                      const b = Number(compareRightKpi[k]) || 0;
                      const delta = b - a;
                      return (
                        <li key={k} className={delta >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {k}: {delta >= 0 ? "+" : ""}{delta >= 1e6 ? `$${(delta / 1e6).toFixed(2)}M` : delta.toFixed(2)}
                        </li>
                      );
                    })}
                    {(["roi", "risk"] as const).map((k) => {
                      const a = Number(compareLeftKpi[k]) || 0;
                      const b = Number(compareRightKpi[k]) || 0;
                      const delta = b - a;
                      return (
                        <li key={k} className={delta >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {k}: {delta >= 0 ? "+" : ""}{delta.toFixed(2)}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-shrink-0 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenGenerateAgentPlan}
                  disabled={!activeId}
                  className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Agent Plan
                </button>
              </div>
              <GenerateAgentPlanModal
                open={generateAgentModalOpen}
                onClose={() => setGenerateAgentModalOpen(false)}
                onGenerated={handleAgentPlansGenerated}
                sourceScenarioId={activeId}
                sourceScenarioName={scenarioDetail?.name ?? ""}
              />
              <div className="flex-1 min-h-0 overflow-auto">
                <ScenarioWorkspace
                  scenarioId={activeId}
                  scenarioName={scenarioDetail?.name ?? ""}
                  kpiSummary={scenarioDetail?.kpiSummary ?? null}
                  promoEvents={scenarioDetail?.promoEvents ?? []}
                  agentInsight={agentInsight}
                  onRefresh={activeId ? () => fetchScenarioDetail(activeId) : undefined}
                />
              </div>
            </div>
          )}
        </ScenarioTabs>
      </div>
    </div>
  );
}
