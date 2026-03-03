/**
 * TPO Optimization - main export
 * runTpoOptimization() returns: recommended allocation, deltas vs base, confidence, risks, explanation
 */

import type { BudgetEntry } from "./scenario";
import type { TPOConstraints } from "./scenario";
import type { Objective } from "./optimizer";
import { generateScenarios } from "./scenario";
import { rankScenarios } from "./optimizer";
import { assessCoverage } from "./coverage";

export interface TPOOptimizationInput {
  period: string;
  objective: Objective;
  constraints?: TPOConstraints;
  baseBudgets: BudgetEntry[];
  responseCurve: Record<string, number>;
  retailers: { id: string; name: string; circanaCoverage: boolean }[];
  inventoryFlags: Record<string, "OK" | "LOW">;
  nScenarios?: number;
}

export interface TPOOptimizationResult {
  recommendedAllocation: Record<string, number>;
  deltasVsBase: Record<string, number>;
  confidence: "high" | "medium" | "low";
  dataGapNote: string | null;
  kpis: {
    incMargin: number;
    revenue: number;
    roi: number;
  };
  explanationBullets: string[];
}

export function runTpoOptimization(input: TPOOptimizationInput): TPOOptimizationResult {
  const {
    baseBudgets,
    responseCurve,
    constraints = {},
    objective,
    retailers,
    inventoryFlags,
    nScenarios = 200,
  } = input;

  const scenarios = generateScenarios(
    baseBudgets,
    responseCurve,
    nScenarios,
    constraints
  );

  const ranked = rankScenarios(scenarios, objective);
  const best = ranked[0];
  const baseByName = Object.fromEntries(
    baseBudgets.map((b) => [b.retailerName, b.spend])
  );

  const deltasVsBase: Record<string, number> = {};
  for (const [name, spend] of Object.entries(best.allocation)) {
    deltasVsBase[name] = spend - (baseByName[name] ?? 0);
  }

  const coverage = assessCoverage(retailers, inventoryFlags);

  const bullets: string[] = [];
  const topGainers = Object.entries(deltasVsBase)
    .filter(([, d]) => d > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  const topLosers = Object.entries(deltasVsBase)
    .filter(([, d]) => d < 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2);

  if (topGainers.length)
    bullets.push(
      `Shift spend to ${topGainers.map(([n]) => n).join(", ")} for higher margin uplift`
    );
  if (topLosers.length)
    bullets.push(
      `Reduce spend at ${topLosers.map(([n]) => n).join(", ")} to reallocate`
    );
  if (coverage.dataGapNote)
    bullets.push(
      `Data improves accuracy: add Circana coverage for ${coverage.retailerCoverage
        .filter((r) => !r.circanaCoverage)
        .map((r) => r.retailerName)
        .join(", ")}`
    );

  return {
    recommendedAllocation: best.allocation,
    deltasVsBase,
    confidence: coverage.overallConfidence,
    dataGapNote: coverage.dataGapNote,
    kpis: {
      incMargin: best.incMargin,
      revenue: best.revenue,
      roi: best.roi,
    },
    explanationBullets: bullets,
  };
}
