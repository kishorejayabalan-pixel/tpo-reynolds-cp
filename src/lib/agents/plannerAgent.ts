/**
 * Planner Agent: proposes candidate plan edits.
 * Pure TS — generates N candidate plans by adjusting discount depth and promo timing within guardrails.
 */

import type { SimPromoEvent } from "@/lib/tpo/simulate";
import { createSeededRng } from "@/lib/tpo/seededRng";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface PlannerGuardrails {
  minDiscount: number;
  maxDiscount: number;
  maxWeekShift: number;
  horizonWeeks: number;
}

const DEFAULT_GUARDRAILS: PlannerGuardrails = {
  minDiscount: 0.05,
  maxDiscount: 0.35,
  maxWeekShift: 2,
  horizonWeeks: 12,
};

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

/**
 * Generate one candidate plan by mutating the current plan: adjust discount depth and shift timing.
 */
function generateOneCandidate(
  currentPlan: SimPromoEvent[],
  rng: () => number,
  guardrails: PlannerGuardrails
): SimPromoEvent[] {
  const horizonEnd = new Date(2026, 0, 1);
  horizonEnd.setDate(horizonEnd.getDate() + guardrails.horizonWeeks * 7);
  const horizonStart = new Date(2026, 0, 1);

  return currentPlan.map((e) => {
    const ev = cloneEvent(e);
    const discountRange = guardrails.maxDiscount - guardrails.minDiscount;
    ev.discountDepth =
      Math.round((guardrails.minDiscount + rng() * discountRange) * 100) / 100;

    const shift =
      Math.floor(rng() * (2 * guardrails.maxWeekShift + 1)) -
      guardrails.maxWeekShift;
    const shiftMs = shift * WEEK_MS;
    ev.periodStart = new Date(ev.periodStart.getTime() + shiftMs);
    ev.periodEnd = new Date(ev.periodEnd.getTime() + shiftMs);

    if (ev.periodStart < horizonStart) {
      ev.periodStart = new Date(horizonStart);
      ev.periodEnd = new Date(
        ev.periodStart.getTime() + ev.durationWeeks * WEEK_MS
      );
    }
    if (ev.periodEnd > horizonEnd) {
      ev.periodEnd = new Date(horizonEnd);
      ev.periodStart = new Date(
        ev.periodEnd.getTime() - ev.durationWeeks * WEEK_MS
      );
    }
    return ev;
  });
}

export interface GenerateCandidatesInput {
  currentPlan: SimPromoEvent[];
  guardrails?: Partial<PlannerGuardrails>;
  nCandidates?: number;
  seed?: number;
}

/**
 * Proposes N candidate plan edits from the current plan.
 * Returns array of candidate plans (each is a full SimPromoEvent[]).
 */
export function generateCandidatePlans(
  input: GenerateCandidatesInput
): SimPromoEvent[][] {
  const {
    currentPlan,
    guardrails: guardrailsOverride = {},
    nCandidates = 30,
    seed = 42,
  } = input;

  const guardrails: PlannerGuardrails = {
    ...DEFAULT_GUARDRAILS,
    ...guardrailsOverride,
  };

  if (currentPlan.length === 0) return [];

  const rng = createSeededRng(seed);
  const candidates: SimPromoEvent[][] = [];

  for (let i = 0; i < nCandidates; i++) {
    candidates.push(generateOneCandidate(currentPlan, rng, guardrails));
  }

  return candidates;
}
