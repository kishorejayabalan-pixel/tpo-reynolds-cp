/**
 * Orchestrator Agent: decides when to re-optimize and applies the chosen plan.
 * Uses planner + risk agents, runs simulation, applies best feasible plan, writes DecisionLog.
 */

import { prisma } from "@/lib/prisma";
import { simulate } from "@/lib/tpo/simulate";
import type {
  SimPromoEvent,
  SimSKU,
  SimRetailer,
  SimulateKPI,
} from "@/lib/tpo/simulate";
import { generateCandidatePlans } from "./plannerAgent";
import { evaluateCandidate } from "./riskAgent";

export interface OrchestratorInput {
  retailerId: string;
  horizonWeeks?: number;
  budget: number;
  period?: string;
  /** Optional: force re-optimize even if no trigger (e.g. for manual run) */
  forceOptimize?: boolean;
  inventoryBySku?: Record<string, number>;
  seed?: number;
  nCandidates?: number;
  minRoi?: number;
  maxStockoutRisk?: number;
}

export interface OrchestratorResult {
  applied: boolean;
  reason: string;
  beforeKpi?: SimulateKPI;
  afterKpi?: SimulateKPI;
  vetoReasons?: string[];
  decisionLogId?: string;
}

const PERIOD_START = new Date(2026, 3, 1); // Q2

function horizonEnd(weeks: number): Date {
  const e = new Date(PERIOD_START);
  e.setDate(e.getDate() + weeks * 7);
  return e;
}

export async function runOrchestrator(
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  const {
    retailerId,
    horizonWeeks = 12,
    budget,
    period = "2026-Q2",
    forceOptimize = false,
    inventoryBySku = {},
    seed = 42,
    nCandidates = 30,
    minRoi = 1.25,
    maxStockoutRisk = 0.2,
  } = input;

  const start = PERIOD_START;
  const end = horizonEnd(horizonWeeks);

  const [retailer, eventsRaw, skusRaw] = await Promise.all([
    prisma.retailer.findUnique({ where: { id: retailerId } }),
    prisma.promoEvent.findMany({
      where: {
        retailerId,
        periodStart: { lte: end },
        periodEnd: { gte: start },
      },
      include: { sku: true },
    }),
    prisma.sKU.findMany({ orderBy: { skuCode: "asc" } }),
  ]);

  if (!retailer) {
    await prisma.decisionLog.create({
      data: {
        retailerId,
        agent: "orchestrator",
        action: "skip",
        reason: "Retailer not found",
        beforeKpiJson: "{}",
        afterKpiJson: null,
        diff: null,
        signalContext: null,
      },
    });
    return { applied: false, reason: "Retailer not found" };
  }

  if (eventsRaw.length === 0) {
    await prisma.decisionLog.create({
      data: {
        retailerId,
        agent: "orchestrator",
        action: "skip",
        reason: "No current plan to optimize",
        beforeKpiJson: "{}",
        afterKpiJson: null,
        diff: null,
        signalContext: null,
      },
    });
    return { applied: false, reason: "No current plan to optimize" };
  }

  const skus: SimSKU[] = skusRaw.map((s) => ({
    id: s.id,
    skuCode: s.skuCode,
    category: s.category,
    brand: s.brand,
    unitCost: s.unitCost,
    basePrice: s.basePrice,
  }));
  const retailerSim: SimRetailer = { id: retailer.id, name: retailer.name };

  const currentPlan: SimPromoEvent[] = eventsRaw.map((e) => ({
    retailerId: e.retailerId,
    skuId: e.skuId,
    periodStart: new Date(e.periodStart),
    periodEnd: new Date(e.periodEnd),
    discountDepth: e.discountDepth,
    durationWeeks: e.durationWeeks,
    baselineUnits: e.baselineUnits,
    promoUnits: e.promoUnits,
    promoType: e.promoType,
    displaySupport: e.displaySupport,
    featureAd: e.featureAd,
    inventoryFlag: e.inventoryFlag,
  }));

  const beforeKpi = simulate({
    events: currentPlan,
    skus,
    retailer: retailerSim,
    horizonWeeks,
    inventoryBySku,
    seed,
    nDraws: 200,
  });

  const candidates = generateCandidatePlans({
    currentPlan,
    horizonWeeks,
    nCandidates,
    seed,
  });

  const evaluated: { plan: SimPromoEvent[]; kpi: SimulateKPI }[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const kpi = simulate({
      events: candidates[i],
      skus,
      retailer: retailerSim,
      horizonWeeks,
      inventoryBySku,
      seed: seed + 1000 + i,
      nDraws: 200,
    });
    evaluated.push({ plan: candidates[i], kpi });
  }

  const feasible = evaluated.filter(({ kpi }) => {
    const verdict = evaluateCandidate(kpi, {
      minRoi,
      maxSpend: budget,
      maxStockoutRisk,
    });
    return verdict.pass;
  });

  feasible.sort((a, b) => b.kpi.revenue - a.kpi.revenue);
  const best = feasible[0];

  if (!best) {
    const vetoSample = evaluated
      .map(({ kpi }) => evaluateCandidate(kpi, { minRoi, maxSpend: budget, maxStockoutRisk }))
      .find((v) => !v.pass);
    const vetoReasons = vetoSample?.vetoReasons ?? ["No feasible plan met constraints"];

    const log = await prisma.decisionLog.create({
      data: {
        retailerId,
        agent: "orchestrator",
        action: "skip",
        reason: `No feasible plan: ${vetoReasons.join("; ")}`,
        beforeKpiJson: JSON.stringify(beforeKpi),
        afterKpiJson: null,
        diff: null,
        signalContext: JSON.stringify({ period, budget, nCandidates }),
      },
    });
    return {
      applied: false,
      reason: "No feasible plan",
      beforeKpi,
      vetoReasons,
      decisionLogId: log.id,
    };
  }

  await prisma.promoEvent.deleteMany({
    where: {
      retailerId,
      periodStart: { gte: start },
      periodEnd: { lte: end },
    },
  });

  const skuIds = new Set(skusRaw.map((s) => s.id));
  for (const ev of best.plan) {
    if (!skuIds.has(ev.skuId)) continue;
    await prisma.promoEvent.create({
      data: {
        retailerId: ev.retailerId,
        skuId: ev.skuId,
        periodStart: ev.periodStart,
        periodEnd: ev.periodEnd,
        discountDepth: ev.discountDepth,
        durationWeeks: ev.durationWeeks,
        baselineUnits: ev.baselineUnits,
        promoUnits: Math.round(ev.baselineUnits * 1.2),
        inventoryFlag: ev.inventoryFlag,
        promoType: ev.promoType,
        displaySupport: ev.displaySupport,
        featureAd: ev.featureAd,
      },
    });
  }

  const afterKpi = best.kpi;
  const diff = {
    revenueDelta: afterKpi.revenue - beforeKpi.revenue,
    marginDelta: afterKpi.margin - beforeKpi.margin,
    roiDelta: afterKpi.roi - beforeKpi.roi,
    spendDelta: afterKpi.spend - beforeKpi.spend,
    stockoutRiskDelta: afterKpi.stockoutRisk - beforeKpi.stockoutRisk,
  };

  const log = await prisma.decisionLog.create({
    data: {
      retailerId,
      agent: "orchestrator",
      action: "apply_plan",
      reason: "Planner proposed candidates; risk agent passed; best revenue selected",
      beforeKpiJson: JSON.stringify(beforeKpi),
      afterKpiJson: JSON.stringify(afterKpi),
      diff: JSON.stringify(diff),
      signalContext: JSON.stringify({
        period,
        budget,
        nCandidates,
        feasibleCount: feasible.length,
      }),
    },
  });

  return {
    applied: true,
    reason: "Plan applied",
    beforeKpi,
    afterKpi,
    decisionLogId: log.id,
  };
}
