/**
 * Reynolds Simulation — Pure math. No agent logic.
 * simulate(plan) -> SimulationResult
 * runReynoldsSimulation() — PromoEvent-based flow (for /api/reynolds-simulation)
 */

import { createSeededRng } from "./seededRng";
import { predictLift } from "../liftModel";

export interface PromotionPlan {
  productId: string;
  promoType: string;
  discountPct: number;
  displayFlag: boolean;
  featureFlag: boolean;
  startWeek: number;
  durationWeeks: number;
}

export interface BaselineRow {
  productId: string;
  productName: string;
  week: number;
  baseUnits: number;
  basePrice: number;
  baseCost: number;
}

export interface SimulateInput {
  promotions: PromotionPlan[];
  baselines: BaselineRow[];
  weeksInPeriod?: number;
}

export interface SimulationResult {
  totalRevenue: number;
  totalMargin: number;
  baseMargin: number;
  incrementalMargin: number;
  totalTradeSpend: number;
  tradeSpendPct: number;
  roi: number;
  totalUnits: number;
  confidence: number;
  risk: number;
  breakdown: Array<{
    productId: string;
    productName: string;
    week: number;
    units: number;
    revenue: number;
    margin: number;
    tradeSpend: number;
  }>;
}

export function simulate(input: SimulateInput): SimulationResult {
  const { promotions, baselines, weeksInPeriod = 13 } = input;

  if (baselines.length === 0) {
    return {
      totalRevenue: 0,
      totalMargin: 0,
      baseMargin: 0,
      incrementalMargin: 0,
      totalTradeSpend: 0,
      tradeSpendPct: 0,
      roi: 0,
      totalUnits: 0,
      confidence: 0.5,
      risk: 0.5,
      breakdown: [],
    };
  }

  let totalRevenue = 0;
  let totalMargin = 0;
  let baseMargin = 0;
  let totalTradeSpend = 0;
  let totalUnits = 0;
  let confSum = 0;
  let confCount = 0;
  const breakdown: SimulationResult["breakdown"] = [];

  for (const bl of baselines) {
    const activePromo = promotions.find(
      (p) =>
        p.productId === bl.productId &&
        bl.week >= p.startWeek &&
        bl.week < p.startWeek + p.durationWeeks
    );

    const basePrice = bl.basePrice;
    const baseCost = bl.baseCost;
    const baseUnits = bl.baseUnits;

    let units = baseUnits;
    let promoPrice = basePrice;
    let discountPct = 0;

    if (activePromo) {
      const { lift, confidence } = predictLift({
        discountPct: activePromo.discountPct,
        promoType: activePromo.promoType,
        displayFlag: activePromo.displayFlag,
        featureFlag: activePromo.featureFlag,
      });
      units = Math.round(baseUnits * lift);
      promoPrice = basePrice * (1 - activePromo.discountPct);
      discountPct = activePromo.discountPct;
      confSum += confidence;
      confCount++;
    }

    const revenue = units * promoPrice;
    const cost = units * baseCost;
    const margin = revenue - cost;
    const tradeSpend = units * basePrice * discountPct;

    totalRevenue += revenue;
    totalMargin += margin;
    baseMargin += (basePrice - baseCost) * baseUnits;
    totalTradeSpend += tradeSpend;
    totalUnits += units;

    breakdown.push({
      productId: bl.productId,
      productName: bl.productName,
      week: bl.week,
      units,
      revenue,
      margin,
      tradeSpend,
    });
  }

  const incrementalMargin = totalMargin - baseMargin;
  const tradeSpendPct =
    totalRevenue > 0 ? totalTradeSpend / totalRevenue : 0;
  const roi = totalTradeSpend > 0 ? incrementalMargin / totalTradeSpend : 0;
  const confidence = confCount > 0 ? confSum / confCount : 0.7;
  const risk = 1 - confidence;

  return {
    totalRevenue,
    totalMargin,
    baseMargin,
    incrementalMargin,
    totalTradeSpend,
    tradeSpendPct,
    roi,
    totalUnits,
    confidence,
    risk,
    breakdown,
  };
}

/* ─── PromoEvent-based flow (reynolds-simulation API) ─── */
export interface ReynoldsEventInput {
  retailerId: string;
  retailerName: string;
  skuId: string;
  skuCode: string;
  basePrice: number;
  unitCost: number;
  baselineUnits: number;
  durationWeeks: number;
}

interface ReynoldsScenarioParams {
  discountPct: number;
  displaySupport: boolean;
  featureAd: boolean;
  promoType: string;
}

export interface ReynoldsScenarioResult {
  totalIncrementalMargin: number;
  totalTradeSpend: number;
  totalRevenue: number;
  tradeSpendPct: number;
  roi: number;
}

function evalReynoldsScenario(
  events: ReynoldsEventInput[],
  paramsList: ReynoldsScenarioParams[]
): ReynoldsScenarioResult {
  let totalIncMargin = 0;
  let totalSpend = 0;
  let totalRev = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const p = paramsList[i];
    const { lift } = predictLift({
      discountPct: p.discountPct,
      promoType: p.promoType,
      displayFlag: p.displaySupport,
      featureFlag: p.featureAd,
    });
    const promoU = Math.round(e.baselineUnits * lift);
    const baseM = (e.basePrice - e.unitCost) * e.baselineUnits;
    const promoM = (e.basePrice * (1 - p.discountPct) - e.unitCost) * promoU;
    totalIncMargin += promoM - baseM;
    totalSpend += e.basePrice * promoU * p.discountPct;
    totalRev += e.basePrice * (1 - p.discountPct) * promoU;
  }
  const tradePct = totalRev > 0 ? totalSpend / totalRev : 0;
  const roi = totalSpend > 0 ? totalIncMargin / totalSpend : 0;
  return { totalIncrementalMargin: totalIncMargin, totalTradeSpend: totalSpend, totalRevenue: totalRev, tradeSpendPct: tradePct, roi };
}

const PROMO_TYPES = ["ALL_PRICE_OFF", "DISPLAY", "FEATURE", "BOGO", "SEASONAL"];

export function runReynoldsSimulation(input: {
  events: ReynoldsEventInput[];
  nSims?: number;
  seed?: number;
}): {
  topScenario: ReynoldsScenarioResult;
  compliantCount: number;
  runtimeMs: number;
} {
  const start = performance.now();
  const rng = createSeededRng(input.seed ?? 42);
  const nSims = input.nSims ?? 1000;
  let best: ReynoldsScenarioResult | null = null;
  let bestScore = -Infinity;
  let compliantCount = 0;

  for (let i = 0; i < nSims; i++) {
    const paramsList: ReynoldsScenarioParams[] = input.events.map(() => ({
      discountPct: 0.05 + rng() * 0.15,
      displaySupport: rng() < 0.35,
      featureAd: rng() < 0.3,
      promoType: PROMO_TYPES[Math.floor(rng() * PROMO_TYPES.length)]!,
    }));
    const r = evalReynoldsScenario(input.events, paramsList);
    if (r.tradeSpendPct >= 0.04 && r.tradeSpendPct <= 0.06) {
      compliantCount++;
      if (r.totalIncrementalMargin > bestScore) {
        bestScore = r.totalIncrementalMargin;
        best = r;
      }
    }
  }

  return {
    topScenario: best ?? {
      totalIncrementalMargin: 0,
      totalTradeSpend: 0,
      totalRevenue: 0,
      tradeSpendPct: 0,
      roi: 0,
    },
    compliantCount,
    runtimeMs: performance.now() - start,
  };
}
