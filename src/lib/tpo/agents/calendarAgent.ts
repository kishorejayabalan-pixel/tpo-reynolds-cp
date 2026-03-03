/**
 * Calendar Agent — generates candidate plan mutations from base plan
 */
import type { PromotionPlan } from "../reynoldsSimulation";
import type { ObjectiveSpec } from "./strategistAgent";

const PROMO_TYPES = [
  "ALL_PRICE_OFF",
  "BOGO",
  "DISPLAY",
  "FEATURE",
  "PR_15",
  "SELL_DEP",
  "PRICE_OFF_2",
  "CLEARANCE",
];

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function runCalendarAgent(
  basePlan: PromotionPlan[],
  spec: ObjectiveSpec,
  rng: () => number
): PromotionPlan[] {
  if (basePlan.length === 0) return [];

  const clone = basePlan.map((p) => ({ ...p }));

  const mutations = Math.floor(rng() * 3) + 1;
  for (let i = 0; i < mutations; i++) {
    const idx = Math.floor(rng() * clone.length);
    const p = clone[idx];
    if (!p) continue;

    const choice = Math.floor(rng() * 4);
    switch (choice) {
      case 0:
        p.discountPct = Math.min(
          spec.guardrails.maxDiscountPct,
          Math.max(0, p.discountPct + randomBetween(-0.02, 0.02))
        );
        break;
      case 1:
        p.startWeek = Math.max(
          0,
          Math.min(12, p.startWeek + Math.floor(randomBetween(-1, 2)))
        );
        break;
      case 2: {
        const others = PROMO_TYPES.filter((t) => t !== p.promoType);
        p.promoType = others[Math.floor(rng() * others.length)] ?? p.promoType;
        break;
      }
      case 3:
        p.displayFlag = !p.displayFlag;
        break;
    }
  }

  return clone;
}
