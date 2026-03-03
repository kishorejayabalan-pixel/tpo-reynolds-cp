/**
 * Risk Agent — pre-check constraints (discount, overlap, BOGO count, weeks)
 */
import type { PromotionPlan } from "../reynoldsSimulation";
import type { ObjectiveSpec } from "./strategistAgent";

export interface RiskCheckResult {
  pass: boolean;
  reasons: string[];
}

export function runRiskAgent(
  plan: PromotionPlan[],
  spec: ObjectiveSpec
): RiskCheckResult {
  const reasons: string[] = [];

  for (const p of plan) {
    if (p.discountPct > spec.guardrails.maxDiscountPct) {
      reasons.push(`Discount ${(p.discountPct * 100).toFixed(0)}% exceeds max ${spec.guardrails.maxDiscountPct * 100}%`);
    }
    if (p.startWeek < 0 || p.startWeek > 12) {
      reasons.push(`Start week ${p.startWeek} out of range [0,12]`);
    }
    const endWeek = p.startWeek + p.durationWeeks;
    if (endWeek > 13) {
      reasons.push(`Promo extends past week 13 (end: ${endWeek})`);
    }
  }

  const byProduct = new Map<string, PromotionPlan[]>();
  for (const p of plan) {
    const arr = byProduct.get(p.productId) ?? [];
    arr.push(p);
    byProduct.set(p.productId, arr);
  }

  for (const [, promos] of byProduct) {
    const bogoCount = promos.filter((p) => p.promoType === "BOGO").length;
    if (bogoCount > spec.guardrails.maxBOGOPerProduct) {
      reasons.push(`BOGO count ${bogoCount} exceeds max ${spec.guardrails.maxBOGOPerProduct} per product`);
    }

    for (let i = 0; i < promos.length; i++) {
      for (let j = i + 1; j < promos.length; j++) {
        const a = promos[i]!;
        const b = promos[j]!;
        const overlap =
          Math.min(a.startWeek + a.durationWeeks, b.startWeek + b.durationWeeks) -
          Math.max(a.startWeek, b.startWeek);
        if (overlap > spec.guardrails.maxOverlappingWeeks) {
          reasons.push(`Overlap of ${overlap} weeks for product ${a.productId}`);
        }
      }
    }
  }

  return {
    pass: reasons.length === 0,
    reasons,
  };
}
