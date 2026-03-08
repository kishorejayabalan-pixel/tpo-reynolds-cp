"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Target, Cpu, BarChart3, Shield, Zap, Sliders, ListOrdered, Database } from "lucide-react";
import { PRIMARY_GOAL, PRICE_LEVERS, PROMOTION_LEVERS, AGENT_PROCESS_STEPS } from "@/lib/tpo/objectiveFramework";

export interface ScenarioSummaryDropdownProps {
  scenarioName: string;
  status?: string;
  objectiveJson: Record<string, unknown> | null;
  kpiSummary: Record<string, unknown> | null;
  agentExplanation?: string | null;
  signalSummary?: string[];
  defaultOpen?: boolean;
  extended?: boolean;
}

export default function ScenarioSummaryDropdown({
  scenarioName,
  status,
  objectiveJson,
  kpiSummary,
  agentExplanation,
  signalSummary = [],
  defaultOpen = false,
  extended = false,
}: ScenarioSummaryDropdownProps) {
  const [open, setOpen] = useState(defaultOpen);

  const primaryGoal = (objectiveJson?.primaryGoal as string) ?? PRIMARY_GOAL;
  const objectiveType = (objectiveJson?.objectiveType as string) ?? "balanced";
  const period = (objectiveJson?.period as string) ?? "—";
  const constraints = (objectiveJson?.constraints as Record<string, unknown>) ?? {};
  const roiMin = constraints.roiMin != null ? Number(constraints.roiMin) : null;
  const spendCap = constraints.spendCap != null ? Number(constraints.spendCap) : null;
  const stockoutMax = constraints.stockoutMax != null ? Number(constraints.stockoutMax) : null;
  const levers = (objectiveJson?.levers as { price?: string[]; promotion?: string[] }) ?? { price: [...PRICE_LEVERS], promotion: [...PROMOTION_LEVERS] };
  const agentSteps = (objectiveJson?.agentSteps as string[] | undefined) ?? [...AGENT_PROCESS_STEPS];
  const dataSource = (objectiveJson?.dataSource as "real" | "synthetic") ?? "real";
  const eventSource = (objectiveJson?.eventSource as string | undefined) ?? "Exceedra";
  const eventSourceMode = (objectiveJson?.eventSourceMode as "live" | "synthetic" | undefined) ?? "synthetic";

  const formatObjType = (s: string) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const roiVal = kpiSummary?.roi != null ? Number(kpiSummary.roi) : null;
  const roiDisplay = roiVal != null ? (roiVal > 10 ? (roiVal / 100).toFixed(2) : roiVal.toFixed(2)) : null;

  return (
    <div className={`rounded-lg border border-slate-700/50 bg-slate-900/40 overflow-hidden ${extended ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/50"
      >
        <span className="text-sm font-medium text-slate-200">Scenario summary</span>
        <span className="text-xs text-slate-500 truncate max-w-[280px] ml-2">
          {scenarioName}
          {status && (
            <span className="ml-2 text-slate-400">
              · {status.replace(/_/g, " ")}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-500 flex-shrink-0 ml-2" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0 ml-2" />
        )}
      </button>

      {open && (
        <div className={`border-t border-slate-700/50 bg-slate-900/60 ${extended ? "p-5" : "p-4"} ${extended ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : "space-y-4"}`}>
          {/* Objective */}
          <section className={extended ? "lg:border-r lg:border-slate-700/50 lg:pr-5" : ""}>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              <Target className="h-3.5 w-3.5" />
              Objective
            </h4>
            <div className="text-sm text-slate-300 space-y-2">
              <p>
                <span className="text-slate-500">Goal:</span>{" "}
                <span className="text-slate-200">{primaryGoal}</span>
              </p>
              <p>
                <span className="text-slate-500">Type:</span>{" "}
                <span className="text-slate-200">{formatObjType(objectiveType)}</span>
              </p>
              <p>
                <span className="text-slate-500">Period:</span>{" "}
                <span className="text-slate-200">{period}</span>
              </p>
              {(roiMin != null || spendCap != null || stockoutMax != null) && (
                <div className="mt-2 pt-2 border-t border-slate-700/40">
                  <p className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                    <Shield className="h-3 w-3" />
                    Guardrails
                  </p>
                  <ul className="text-slate-400 text-xs space-y-0.5">
                    {roiMin != null && <li>ROI floor ≥ {roiMin.toFixed(2)}</li>}
                    {spendCap != null && <li>Spend cap ${(spendCap / 1e6).toFixed(2)} Million</li>}
                    {stockoutMax != null && <li>Stockout max {(stockoutMax * 100).toFixed(0)}%</li>}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* Levers + What the agent considered */}
          <section className={extended ? "lg:border-r lg:border-slate-700/50 lg:pr-5" : ""}>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              <Sliders className="h-3.5 w-3.5" />
              Levers
            </h4>
            <div className="text-xs text-slate-400 space-y-2 mb-4">
              <p className="text-slate-500">Price</p>
              <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                {(levers.price ?? PRICE_LEVERS).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
              <p className="text-slate-500 mt-2">Promotion</p>
              <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                {(levers.promotion ?? PROMOTION_LEVERS).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 mt-4">
              <Cpu className="h-3.5 w-3.5" />
              What the agent considered
            </h4>
            <div className="text-sm text-slate-300 space-y-2">
              {agentExplanation?.trim() ? (
                <p className="text-slate-200 leading-relaxed text-xs">{agentExplanation}</p>
              ) : (
                <p className="text-slate-500 italic text-xs">No agent explanation for this scenario.</p>
              )}
              {signalSummary.length > 0 && (
                <div className="mt-2">
                  <p className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                    <Zap className="h-3 w-3" />
                    Signals used
                  </p>
                  <ul className="list-disc list-inside text-slate-400 text-xs space-y-0.5">
                    {signalSummary.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* Process steps + Data + TPO context + KPIs */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              <ListOrdered className="h-3.5 w-3.5" />
              Process steps
            </h4>
            <ol className="text-xs text-slate-300 space-y-1.5 mb-4 list-decimal list-inside">
              {agentSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
              <Database className="h-3.5 w-3.5" />
              <span>
                Data:{" "}
                {dataSource === "synthetic" ? (
                  <span className="text-amber-400/90">Synthetic data used where elasticity and post-promo data were unavailable.</span>
                ) : (
                  <span className="text-slate-300">Real</span>
                )}
              </span>
            </div>
            {eventSource === "Exceedra" && (
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                <Zap className="h-3.5 w-3.5" />
                <span>
                  Event inputs:{" "}
                  <span className="text-indigo-300/90 font-medium">Exceedra</span>
                  {" "}({eventSourceMode === "synthetic" ? (
                    <span className="text-amber-400/90">synthetic — demo mode without live Exceedra feed</span>
                  ) : (
                    <span className="text-emerald-400/90">live</span>
                  )})
                </span>
              </div>
            )}
            <h4 className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              <BarChart3 className="h-3.5 w-3.5" />
              TPO context
            </h4>
            <div className="text-xs text-slate-400 space-y-2">
              <p className="leading-relaxed">
                Trade Promotion Optimization balances <span className="text-slate-300">revenue</span>,{" "}
                <span className="text-slate-300">margin</span>, and <span className="text-slate-300">ROI</span> against
                spend and stockout risk. This plan applies guardrails (ROI floor, spend cap, stockout max) and uses
                mechanics (TPR, BOGO, Display, Feature, Seasonal) by segment and week to align with category demand and
                retailer priorities.
              </p>
              {kpiSummary && (
                <div className="mt-3 pt-3 border-t border-slate-700/40">
                  <p className="text-slate-500 text-xs mb-2">Current plan KPIs</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {kpiSummary.revenue != null && (
                      <span className="text-cyan-400/90 font-medium">
                        Revenue ${(Number(kpiSummary.revenue) / 1e6).toFixed(2)} Million
                      </span>
                    )}
                    {kpiSummary.volume != null && (
                      <span className="text-slate-300">
                        Volume {(Number(kpiSummary.volume) / 1e6).toFixed(2)} Million units
                      </span>
                    )}
                    {kpiSummary.margin != null && (
                      <span className="text-emerald-400/90 font-medium">
                        Margin ${(Number(kpiSummary.margin) / 1e6).toFixed(2)} Million
                      </span>
                    )}
                    {kpiSummary.roi != null && (
                      <span className="text-indigo-400/90 font-medium">
                        ROI {roiDisplay ?? Number(kpiSummary.roi).toFixed(2)}
                      </span>
                    )}
                    {kpiSummary.spend != null && (
                      <span className="text-amber-400/90">
                        Spend ${(Number(kpiSummary.spend) / 1e6).toFixed(2)} Million
                      </span>
                    )}
                    {kpiSummary.risk != null && (
                      <span className="text-red-400/90">
                        Risk {(Number(kpiSummary.risk) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
