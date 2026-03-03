/**
 * Quant Agent — runs simulation + metrics + optimizer; rejects by spend band
 */
import { simulate, type PromotionPlan, type BaselineRow } from "../reynoldsSimulation";
import { calculateMetrics } from "../metrics";
import { scoreScenario } from "../optimizer";
import type { ObjectiveSpec } from "./strategistAgent";

export interface QuantResult {
  pass: boolean;
  metrics: ReturnType<typeof calculateMetrics>;
  score: number;
  reason?: string;
}

export function runQuantAgent(
  plan: PromotionPlan[],
  baselines: BaselineRow[],
  spec: ObjectiveSpec,
  weeksInPeriod: number
): QuantResult {
  const sim = simulate({ promotions: plan, baselines, weeksInPeriod });
  const metrics = calculateMetrics(sim);

  if (
    metrics.tradeSpendPct < spec.guardrails.tradeSpendPctMin ||
    metrics.tradeSpendPct > spec.guardrails.tradeSpendPctMax
  ) {
    return {
      pass: false,
      metrics,
      score: 0,
      reason: `Trade spend ${(metrics.tradeSpendPct * 100).toFixed(2)}% outside band [${spec.guardrails.tradeSpendPctMin * 100}%, ${spec.guardrails.tradeSpendPctMax * 100}%]`,
    };
  }

  const score = scoreScenario(metrics, {
    objectiveType: spec.objectiveType,
    tradeSpendPctMin: spec.guardrails.tradeSpendPctMin,
    tradeSpendPctMax: spec.guardrails.tradeSpendPctMax,
    maxDiscountPct: spec.guardrails.maxDiscountPct,
  });

  return {
    pass: true,
    metrics,
    score,
  };
}
