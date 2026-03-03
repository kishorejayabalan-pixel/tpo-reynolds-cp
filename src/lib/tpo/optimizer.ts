/**
 * Scoring engine: scoreScenario(metrics, objective) -> number
 * rankScenarios: budget allocation (for tpo/index)
 */

import type { MetricResult } from "./metrics";
import type { Scenario } from "./scenario";

export type Objective = "maximize_margin" | "maximize_revenue" | "balanced";

export interface ObjectiveConstraints {
  objectiveType: string; // MAX_MARGIN, MAX_ROI, MAX_UNITS, BALANCED
  tradeSpendPctMin?: number;
  tradeSpendPctMax?: number;
  maxDiscountPct?: number;
  targetRevenue?: number;
  targetMargin?: number;
}

const TARGET_REVENUE_PENALTY = 1e9;
const TARGET_MARGIN_PENALTY = 1e8;

export function scoreScenario(
  metrics: MetricResult,
  objective: ObjectiveConstraints
): number {
  let score: number;
  switch (objective.objectiveType) {
    case "MAX_MARGIN":
      score = metrics.incrementalMargin;
      break;
    case "MAX_ROI":
      score = metrics.roi * 1e6;
      break;
    case "MAX_UNITS":
      score = metrics.totalUnits;
      break;
    case "BALANCED":
      score =
        metrics.incrementalMargin * 0.5 +
        metrics.roi * 500000 -
        metrics.risk * 100000;
      break;
    default:
      score = metrics.incrementalMargin;
  }

  if (objective.targetRevenue != null && objective.targetRevenue > 0) {
    if (metrics.totalRevenue < objective.targetRevenue) {
      const shortfall = objective.targetRevenue - metrics.totalRevenue;
      score -= TARGET_REVENUE_PENALTY + shortfall * 0.1;
    }
  }
  if (objective.targetMargin != null && objective.targetMargin > 0) {
    if (metrics.totalMargin < objective.targetMargin) {
      const shortfall = objective.targetMargin - metrics.totalMargin;
      score -= TARGET_MARGIN_PENALTY + shortfall * 0.1;
    }
  }

  return score;
}

export function meetsTargets(
  metrics: MetricResult,
  objective: ObjectiveConstraints
): boolean {
  if (objective.targetRevenue != null && objective.targetRevenue > 0) {
    if (metrics.totalRevenue < objective.targetRevenue) return false;
  }
  if (objective.targetMargin != null && objective.targetMargin > 0) {
    if (metrics.totalMargin < objective.targetMargin) return false;
  }
  return true;
}

export function rankScenarios(
  scenarios: Scenario[],
  objective: Objective
): Scenario[] {
  const copy = [...scenarios];
  if (objective === "maximize_margin") {
    copy.sort((a, b) => b.incMargin - a.incMargin);
  } else if (objective === "maximize_revenue") {
    copy.sort((a, b) => b.revenue - a.revenue);
  } else {
    copy.sort((a, b) => b.balancedScore - a.balancedScore);
  }
  return copy;
}
