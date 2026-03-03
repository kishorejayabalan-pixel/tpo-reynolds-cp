/**
 * Narrator Agent — produces executive explanation and top changes
 */
import type { MetricResult } from "../metrics";
import type { PromotionPlan } from "../reynoldsSimulation";

export interface NarratorOutput {
  executiveSummary: string;
  topChanges: string[];
  deltas: {
    incrementalMargin: number;
    roi: number;
    tradeSpendPct: number;
    totalUnits: number;
  };
}

export function runNarratorAgent(
  baseMetrics: MetricResult,
  bestMetrics: MetricResult,
  basePlan: PromotionPlan[],
  bestPlan: PromotionPlan[]
): NarratorOutput {
  const incMarginDelta = bestMetrics.incrementalMargin - baseMetrics.incrementalMargin;
  const roiDelta = bestMetrics.roi - baseMetrics.roi;
  const spendDelta = bestMetrics.tradeSpendPct - baseMetrics.tradeSpendPct;
  const unitsDelta = (bestMetrics.totalUnits ?? 0) - (baseMetrics.totalUnits ?? 0);

  const executiveSummary =
    incMarginDelta > 0
      ? `Optimization adds $${(incMarginDelta / 1e6).toFixed(2)}M incremental margin with ${(roiDelta * 100).toFixed(1)}pp ROI improvement. Trade spend moves ${spendDelta >= 0 ? "+" : ""}${(spendDelta * 100).toFixed(2)}pp.`
      : `Plan maintains margin profile. Trade spend ${(bestMetrics.tradeSpendPct * 100).toFixed(2)}%, ROI ${(bestMetrics.roi * 100).toFixed(1)}%.`;

  const topChanges: string[] = [];

  const byProductBase = new Map<string, PromotionPlan[]>();
  const byProductBest = new Map<string, PromotionPlan[]>();
  for (const p of basePlan) {
    const arr = byProductBase.get(p.productId) ?? [];
    arr.push(p);
    byProductBase.set(p.productId, arr);
  }
  for (const p of bestPlan) {
    const arr = byProductBest.get(p.productId) ?? [];
    arr.push(p);
    byProductBest.set(p.productId, arr);
  }

  const products = new Set([...byProductBase.keys(), ...byProductBest.keys()]);
  for (const productId of products) {
    const base = byProductBase.get(productId) ?? [];
    const best = byProductBest.get(productId) ?? [];
    const avgDiscountBase = base.length ? base.reduce((s, p) => s + p.discountPct, 0) / base.length : 0;
    const avgDiscountBest = best.length ? best.reduce((s, p) => s + p.discountPct, 0) / best.length : 0;
    const discountDelta = avgDiscountBest - avgDiscountBase;
    if (Math.abs(discountDelta) > 0.01) {
      topChanges.push(
        `Product ${productId}: discount ${discountDelta >= 0 ? "+" : ""}${(discountDelta * 100).toFixed(0)}pp`
      );
    }
    const bogoBase = base.filter((p) => p.promoType === "BOGO").length;
    const bogoBest = best.filter((p) => p.promoType === "BOGO").length;
    if (bogoBest !== bogoBase) {
      topChanges.push(`Product ${productId}: BOGO count ${bogoBase} → ${bogoBest}`);
    }
  }

  topChanges.push(
    `Incremental margin: $${(baseMetrics.incrementalMargin / 1e6).toFixed(2)}M → $${(bestMetrics.incrementalMargin / 1e6).toFixed(2)}M (${incMarginDelta >= 0 ? "+" : ""}$${(incMarginDelta / 1e6).toFixed(2)}M)`
  );
  topChanges.push(
    `ROI: ${(baseMetrics.roi * 100).toFixed(1)}% → ${(bestMetrics.roi * 100).toFixed(1)}% (${roiDelta >= 0 ? "+" : ""}${(roiDelta * 100).toFixed(1)}pp)`
  );

  return {
    executiveSummary,
    topChanges: topChanges.slice(0, 6),
    deltas: {
      incrementalMargin: incMarginDelta,
      roi: roiDelta,
      tradeSpendPct: spendDelta,
      totalUnits: unitsDelta,
    },
  };
}
