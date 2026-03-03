/**
 * TPO Monte Carlo simulation.
 * Input: promo events + SKUs + retailer + horizon weeks.
 * Output: KPI summary + p10/p50/p90 revenue (200 draws).
 * Lift model by discount + mechanic; competitor shock + demand noise; inventory cap → stockoutRisk.
 */

import { createSeededRng } from "./seededRng";

// ─── Input types (Prisma-agnostic) ───
export interface SimPromoEvent {
  retailerId: string;
  skuId: string;
  periodStart: Date;
  periodEnd: Date;
  discountDepth: number;
  durationWeeks: number;
  baselineUnits: number;
  promoUnits: number;
  promoType: string | null;
  displaySupport: boolean | null;
  featureAd: boolean | null;
  inventoryFlag: string;
}

export interface SimSKU {
  id: string;
  skuCode: string;
  category: string;
  brand: string;
  unitCost: number;
  basePrice: number;
}

export interface SimRetailer {
  id: string;
  name: string;
}

export interface SimulateInput {
  events: SimPromoEvent[];
  skus: SimSKU[];
  retailer: SimRetailer;
  horizonWeeks: number;
  /** Optional: on-hand inventory by skuId (units). If below demand, stockout penalty applies. */
  inventoryBySku?: Record<string, number>;
  seed?: number;
  nDraws?: number;
}

// ─── Output ───
export interface SimulateKPI {
  revenue: number;
  units: number;
  margin: number;
  spend: number;
  roi: number;
  stockoutRisk: number;
  revenueP10: number;
  revenueP50: number;
  revenueP90: number;
}

const MECHANICS = ["TPR", "BOGO", "Display", "Feature"] as const;
type Mechanic = (typeof MECHANICS)[number];

function normalizeMechanic(promoType: string | null): Mechanic {
  if (!promoType) return "TPR";
  const u = promoType.toUpperCase();
  if (u === "BOGO") return "BOGO";
  if (u === "DISPLAY") return "Display";
  if (u.includes("FEATURE")) return "Feature";
  return "TPR";
}

/** Simple lift multiplier from discount and mechanic. */
function liftFromDiscountAndMechanic(
  discount: number,
  mechanic: Mechanic
): number {
  let base = 1;
  if (mechanic === "TPR") base += discount * 2.2;
  else if (mechanic === "BOGO") base += 0.85 + discount * 0.5;
  else if (mechanic === "Display") base += 0.35 + discount * 1.2;
  else base += 0.25 + discount * 1;
  return Math.max(1, base);
}

/** One scenario (one Monte Carlo draw). */
function runOneScenario(
  events: SimPromoEvent[],
  skuMap: Map<string, SimSKU>,
  retailerId: string,
  horizonWeeks: number,
  inventoryBySku: Record<string, number>,
  rng: () => number,
  options: {
    competitorShockPct: number;
    demandNoisePct: number;
  }
): { revenue: number; units: number; margin: number; spend: number; stockoutPenalty: number; hadStockout: boolean } {
  let revenue = 0;
  let units = 0;
  let margin = 0;
  let spend = 0;
  let stockoutPenalty = 0;
  let hadStockout = false;

  const horizonEnd = new Date(2026, 0, 1);
  horizonEnd.setDate(horizonEnd.getDate() + horizonWeeks * 7);

  for (const e of events) {
    if (e.retailerId !== retailerId) continue;

    const sku = skuMap.get(e.skuId);
    if (!sku) continue;

    const mechanic = normalizeMechanic(e.promoType);
    const liftBase = liftFromDiscountAndMechanic(e.discountDepth, mechanic);

    const noise = 1 + (rng() * 2 - 1) * options.demandNoisePct;
    const shock = 1 + (rng() * 0.1 - 0.08);
    const lift = liftBase * noise * shock;

    let promoUnits = Math.round(e.baselineUnits * lift);
    const price = sku.basePrice * (1 - e.discountDepth);
    const inv = inventoryBySku[e.skuId];

    if (inv !== undefined && promoUnits > inv) {
      const shortfall = promoUnits - inv;
      stockoutPenalty += shortfall * price * 0.15;
      promoUnits = inv;
      hadStockout = true;
    }

    const eventRevenue = promoUnits * price;
    const eventCost = promoUnits * sku.unitCost;
    const eventSpend = e.baselineUnits * e.discountDepth * sku.basePrice;

    revenue += eventRevenue;
    units += promoUnits;
    margin += eventRevenue - eventCost;
    spend += eventSpend;
  }

  return { revenue, units, margin, spend, stockoutPenalty, hadStockout };
}

export function simulate(input: SimulateInput): SimulateKPI {
  const {
    events,
    skus,
    retailer,
    horizonWeeks,
    inventoryBySku = {},
    seed = 42,
    nDraws = 200,
  } = input;

  const skuMap = new Map(skus.map((s) => [s.id, s]));

  const horizonEnd = new Date(2026, 0, 1);
  horizonEnd.setDate(horizonEnd.getDate() + horizonWeeks * 7);

  const relevantEvents = events.filter(
    (e) =>
      e.retailerId === retailer.id &&
      e.periodEnd >= new Date(2026, 0, 1) &&
      e.periodStart <= horizonEnd
  );

  if (relevantEvents.length === 0) {
    return {
      revenue: 0,
      units: 0,
      margin: 0,
      spend: 0,
      roi: 0,
      stockoutRisk: 0,
      revenueP10: 0,
      revenueP50: 0,
      revenueP90: 0,
    };
  }

  const rng = createSeededRng(seed);
  const revenues: number[] = [];
  let sumRevenue = 0;
  let sumUnits = 0;
  let sumMargin = 0;
  let sumSpend = 0;
  let sumStockoutPenalty = 0;
  let drawsWithStockout = 0;

  const competitorShockPct = 0.08;
  const demandNoisePct = 0.12;

  for (let i = 0; i < nDraws; i++) {
    const r = runOneScenario(
      relevantEvents,
      skuMap,
      retailer.id,
      horizonWeeks,
      inventoryBySku,
      rng,
      { competitorShockPct, demandNoisePct }
    );
    revenues.push(r.revenue);
    sumRevenue += r.revenue;
    sumUnits += r.units;
    sumMargin += r.margin;
    sumSpend += r.spend;
    sumStockoutPenalty += r.stockoutPenalty;
    if (r.hadStockout) drawsWithStockout += 1;
  }

  revenues.sort((a, b) => a - b);
  const p10 = Math.floor(nDraws * 0.1);
  const p50 = Math.floor(nDraws * 0.5);
  const p90 = Math.floor(nDraws * 0.9);

  const n = nDraws;
  const revenue = sumRevenue / n;
  const units = Math.round(sumUnits / n);
  const margin = sumMargin / n;
  const spend = sumSpend / n;
  const roi = spend > 0 ? margin / spend : 0;
  const fracStockout = drawsWithStockout / n;
  const penaltyNorm = sumRevenue > 0 ? Math.min(1, sumStockoutPenalty / sumRevenue) : 0;
  const stockoutRisk = Math.min(1, fracStockout * 0.6 + penaltyNorm * 0.4);

  return {
    revenue,
    units,
    margin,
    spend,
    roi,
    stockoutRisk,
    revenueP10: revenues[p10] ?? revenue,
    revenueP50: revenues[p50] ?? revenue,
    revenueP90: revenues[p90] ?? revenue,
  };
}
