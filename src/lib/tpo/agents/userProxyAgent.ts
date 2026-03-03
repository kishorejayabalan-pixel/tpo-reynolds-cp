/**
 * UserProxyAgent — generates an initial draft promo calendar as if a human planner created it.
 * Used in Agent (Autopilot) mode when no DRAFT plan exists.
 */
import type { PromotionPlan } from "../reynoldsSimulation";

const PROMO_TYPES = [
  "ALL_PRICE_OFF",
  "BOGO",
  "DISPLAY",
  "FEATURE",
  "PR_15",
  "SELL_DEP",
  "PRICE_OFF_2",
  "CLEARANCE",
] as const;

const DISPLAY_FEATURE_TYPES = ["DISPLAY", "FEATURE"] as const;

export interface UserProxyInput {
  period: string;
  retailerId: string;
  products: Array<{ productId: string }>;
  constraints: {
    maxDiscountPct?: number;
    spendPctMin?: number;
    spendPctMax?: number;
  };
  targetRevenue?: number;
  targetMargin?: number;
  objectiveType?: string; // MAX_MARGIN, MAX_ROI, MAX_UNITS, BALANCED
  startWeek?: number;
  endWeek?: number;
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Check if week ranges overlap
 */
function overlaps(
  startA: number,
  durA: number,
  startB: number,
  durB: number
): boolean {
  const endA = startA + durA;
  const endB = startB + durB;
  return startA < endB && startB < endA;
}

export function generateInitialPlan(input: UserProxyInput): PromotionPlan[] {
  const {
    products,
    constraints,
    targetRevenue,
    objectiveType = "BALANCED",
    startWeek = 15,
    endWeek = 28,
  } = input;

  const maxDiscountPct = constraints.maxDiscountPct ?? 0.2;
  const preferDisplayFeature =
    !!targetRevenue || objectiveType === "MAX_MARGIN" || objectiveType === "BALANCED";
  const maxBOGO = objectiveType === "MAX_UNITS" ? 3 : 2;

  if (products.length === 0) return [];

  const weekSpan = endWeek - startWeek;
  const promoCount = Math.min(
    Math.max(6, Math.floor(products.length * 1.5)),
    12
  );

  const plan: PromotionPlan[] = [];
  const productPromos = new Map<string, Array<{ startWeek: number; durationWeeks: number }>>();

  const productIds = products.map((p) => p.productId);
  const shuffledProducts = shuffle(productIds);

  let bogoCountByProduct = new Map<string, number>();

  for (let i = 0; i < promoCount; i++) {
    const productId = shuffledProducts[i % shuffledProducts.length]!;

    // Moderate discount 10-20%
    const discountPct = Math.min(
      maxDiscountPct,
      randomBetween(0.1, Math.min(0.2, maxDiscountPct))
    );

    let promoType: string;
    const bogoCount = bogoCountByProduct.get(productId) ?? 0;
    if (bogoCount < maxBOGO && Math.random() < 0.25) {
      promoType = "BOGO";
      bogoCountByProduct.set(productId, bogoCount + 1);
    } else if (preferDisplayFeature && Math.random() < 0.4) {
      promoType = DISPLAY_FEATURE_TYPES[Math.floor(Math.random() * DISPLAY_FEATURE_TYPES.length)] ?? "DISPLAY";
    } else {
      const nonBogo = PROMO_TYPES.filter((t) => t !== "BOGO");
      promoType = nonBogo[Math.floor(Math.random() * nonBogo.length)] ?? "ALL_PRICE_OFF";
    }

    const displayFlag = promoType === "DISPLAY" || (promoType !== "BOGO" && Math.random() < 0.2);
    const featureFlag = promoType === "FEATURE" || (promoType !== "BOGO" && Math.random() < 0.15);

    const durationWeeks = Math.floor(randomBetween(2, 4));
    const maxStart = weekSpan - durationWeeks;
    if (maxStart < 0) continue;

    const existing = productPromos.get(productId) ?? [];
    let startWeekVal: number;
    let attempts = 0;
    do {
      startWeekVal = startWeek + Math.floor(Math.random() * (maxStart + 1));
      const hasOverlap = existing.some((e) =>
        overlaps(e.startWeek, e.durationWeeks, startWeekVal, durationWeeks)
      );
      if (!hasOverlap) break;
      attempts++;
      if (attempts > 20) break;
    } while (true);

    const hasOverlap = existing.some((e) =>
      overlaps(e.startWeek, e.durationWeeks, startWeekVal, durationWeeks)
    );
    if (hasOverlap) continue;

    existing.push({ startWeek: startWeekVal, durationWeeks });
    productPromos.set(productId, existing);

    plan.push({
      productId,
      promoType,
      discountPct,
      displayFlag,
      featureFlag,
      startWeek: startWeekVal,
      durationWeeks,
    });
  }

  return plan;
}
