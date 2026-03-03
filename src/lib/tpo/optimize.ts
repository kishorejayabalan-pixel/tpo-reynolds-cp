/**
 * TPO Optimizer: generate candidate plans, simulate each, select top 5 by revenue
 * subject to ROI >= 1.25, spend <= budget, stockoutRisk <= 0.2.
 */

import { simulate, type SimPromoEvent, type SimSKU, type SimRetailer, type SimulateKPI } from "./simulate";
import { createSeededRng } from "./seededRng";

export type { SimPromoEvent, SimSKU, SimRetailer, SimulateKPI };

export interface OptimizeInput {
  events: SimPromoEvent[];
  skus: SimSKU[];
  retailer: SimRetailer;
  horizonWeeks: number;
  budget: number;
  inventoryBySku?: Record<string, number>;
  seed?: number;
  nCandidates?: number;
  /** Guardrails */
  minDiscount?: number;
  maxDiscount?: number;
  maxWeekShift?: number;
  minRoi?: number;
  maxStockoutRisk?: number;
}

export interface PlanWithKPI {
  plan: SimPromoEvent[];
  kpi: SimulateKPI;
}

export interface OptimizeResult {
  top5: PlanWithKPI[];
  bestPlan: PlanWithKPI | null;
  feasibleCount: number;
  totalCandidates: number;
}

const DEFAULT_MIN_DISCOUNT = 0.05;
const DEFAULT_MAX_DISCOUNT = 0.35;
const DEFAULT_MAX_WEEK_SHIFT = 2;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function cloneEvent(e: SimPromoEvent): SimPromoEvent {
  return {
    retailerId: e.retailerId,
    skuId: e.skuId,
    periodStart: new Date(e.periodStart.getTime()),
    periodEnd: new Date(e.periodEnd.getTime()),
    discountDepth: e.discountDepth,
    durationWeeks: e.durationWeeks,
    baselineUnits: e.baselineUnits,
    promoUnits: e.promoUnits,
    promoType: e.promoType,
    displaySupport: e.displaySupport,
    featureAd: e.featureAd,
    inventoryFlag: e.inventoryFlag,
  };
}

/** Generate one candidate plan by adjusting discount depth and shifting timing within guardrails. */
function generateCandidate(
  events: SimPromoEvent[],
  rng: () => number,
  guardrails: {
    minDiscount: number;
    maxDiscount: number;
    maxWeekShift: number;
    horizonWeeks: number;
  }
): SimPromoEvent[] {
  const candidate: SimPromoEvent[] = [];

  for (const e of events) {
    const ev = cloneEvent(e);

    const discountRange = guardrails.maxDiscount - guardrails.minDiscount;
    const newDiscount =
      guardrails.minDiscount + rng() * discountRange;
    ev.discountDepth = Math.round(newDiscount * 100) / 100;

    const shift =
      Math.floor(rng() * (2 * guardrails.maxWeekShift + 1)) -
      guardrails.maxWeekShift;
    const shiftMs = shift * WEEK_MS;
    ev.periodStart = new Date(ev.periodStart.getTime() + shiftMs);
    ev.periodEnd = new Date(ev.periodEnd.getTime() + shiftMs);

    const horizonEnd = new Date(2026, 0, 1);
    horizonEnd.setDate(horizonEnd.getDate() + guardrails.horizonWeeks * 7);
    if (ev.periodStart < new Date(2026, 0, 1)) {
      ev.periodStart = new Date(2026, 0, 1);
      ev.periodEnd = new Date(ev.periodStart.getTime() + ev.durationWeeks * WEEK_MS);
    }
    if (ev.periodEnd > horizonEnd) {
      ev.periodEnd = new Date(horizonEnd);
      ev.periodStart = new Date(ev.periodEnd.getTime() - ev.durationWeeks * WEEK_MS);
    }

    candidate.push(ev);
  }

  return candidate;
}

export function optimize(input: OptimizeInput): OptimizeResult {
  const {
    events,
    skus,
    retailer,
    horizonWeeks,
    budget,
    inventoryBySku = {},
    seed = 42,
    nCandidates = 30,
    minDiscount = DEFAULT_MIN_DISCOUNT,
    maxDiscount = DEFAULT_MAX_DISCOUNT,
    maxWeekShift = DEFAULT_MAX_WEEK_SHIFT,
    minRoi = 1.25,
    maxStockoutRisk = 0.2,
  } = input;

  const guardrails = {
    minDiscount,
    maxDiscount,
    maxWeekShift,
    horizonWeeks,
  };

  const rng = createSeededRng(seed);
  const candidates: SimPromoEvent[][] = [];

  for (let i = 0; i < nCandidates; i++) {
    candidates.push(generateCandidate(events, rng, guardrails));
  }

  const results: PlanWithKPI[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const kpi = simulate({
      events: candidates[i],
      skus,
      retailer,
      horizonWeeks,
      inventoryBySku,
      seed: seed + 1000 + i,
      nDraws: 200,
    });
    results.push({ plan: candidates[i], kpi });
  }

  const feasible = results.filter(
    (r) =>
      r.kpi.roi >= minRoi &&
      r.kpi.spend <= budget &&
      r.kpi.stockoutRisk <= maxStockoutRisk
  );

  feasible.sort((a, b) => b.kpi.revenue - a.kpi.revenue);
  const top5 = feasible.slice(0, 5);
  const bestPlan = top5[0] ?? null;

  return {
    top5,
    bestPlan,
    feasibleCount: feasible.length,
    totalCandidates: nCandidates,
  };
}
