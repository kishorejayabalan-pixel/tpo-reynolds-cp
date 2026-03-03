/**
 * Pure KPI calculations from simulation result
 */

import type { SimulationResult } from "./reynoldsSimulation";

export interface MetricResult {
  incrementalMargin: number;
  totalMargin: number;
  roi: number;
  tradeSpendPct: number;
  risk: number;
  confidence: number;
  totalRevenue: number;
  totalUnits: number;
}

export function calculateMetrics(simResult: SimulationResult): MetricResult {
  return {
    incrementalMargin: simResult.incrementalMargin,
    totalMargin: simResult.totalMargin,
    roi: simResult.roi,
    tradeSpendPct: simResult.tradeSpendPct,
    risk: simResult.risk,
    confidence: simResult.confidence,
    totalRevenue: simResult.totalRevenue,
    totalUnits: simResult.totalUnits,
  };
}
