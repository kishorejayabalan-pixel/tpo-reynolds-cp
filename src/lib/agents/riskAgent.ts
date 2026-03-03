/**
 * Risk Agent: inventory + ROI guardrails.
 * Vetoes candidates that violate constraints (ROI, spend, stockout risk).
 */

import type { SimulateKPI } from "@/lib/tpo/simulate";

export interface RiskConstraints {
  minRoi?: number;
  maxSpend?: number;
  maxStockoutRisk?: number;
}

const DEFAULT_CONSTRAINTS: Required<RiskConstraints> = {
  minRoi: 1.25,
  maxSpend: Number.POSITIVE_INFINITY,
  maxStockoutRisk: 0.2,
};

export interface RiskVerdict {
  pass: boolean;
  vetoReasons: string[];
}

/**
 * Evaluate a candidate's KPI against guardrails.
 * Returns pass/fail and list of veto reasons when failed.
 */
export function evaluateCandidate(
  kpi: SimulateKPI,
  constraints?: RiskConstraints
): RiskVerdict {
  const c = { ...DEFAULT_CONSTRAINTS, ...constraints };
  const vetoReasons: string[] = [];

  if (kpi.roi < c.minRoi) {
    vetoReasons.push(`ROI ${kpi.roi.toFixed(2)} below minimum ${c.minRoi}`);
  }
  if (kpi.spend > c.maxSpend) {
    vetoReasons.push(
      `Spend ${kpi.spend.toFixed(0)} exceeds budget ${c.maxSpend}`
    );
  }
  if (kpi.stockoutRisk > c.maxStockoutRisk) {
    vetoReasons.push(
      `Stockout risk ${kpi.stockoutRisk.toFixed(2)} above limit ${c.maxStockoutRisk}`
    );
  }

  return {
    pass: vetoReasons.length === 0,
    vetoReasons,
  };
}
