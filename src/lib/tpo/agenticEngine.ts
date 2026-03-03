/**
 * Agentic Engine — Intelligence lives here
 * runAgent(objectiveId) -> scenario.id
 * runAgenticOptimization() -> budget allocation for chat agent
 */

import { createSeededRng } from "./seededRng";
import { prisma } from "../db";
import { simulate, type PromotionPlan } from "./reynoldsSimulation";
import { calculateMetrics } from "./metrics";
import { scoreScenario } from "./optimizer";

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

function swapPromoType(current: string): string {
  const others = PROMO_TYPES.filter((p) => p !== current);
  return others[Math.floor(Math.random() * others.length)] ?? current;
}

function mutatePlan(
  plan: PromotionPlan[],
  objective: { maxDiscountPct: number }
): PromotionPlan[] {
  if (plan.length === 0) return plan;
  const clone = structuredClone(plan);
  const promo = clone[Math.floor(Math.random() * clone.length)];
  if (!promo) return clone;

  const mutationType = Math.floor(Math.random() * 4);

  switch (mutationType) {
    case 0:
      promo.discountPct = Math.min(
        objective.maxDiscountPct,
        Math.max(0, promo.discountPct + randomBetween(-0.02, 0.02))
      );
      break;
    case 1:
      promo.startWeek = Math.max(
        0,
        Math.min(12, promo.startWeek + Math.floor(randomBetween(-1, 2)))
      );
      break;
    case 2:
      promo.promoType = swapPromoType(promo.promoType);
      break;
    case 3:
      promo.displayFlag = !promo.displayFlag;
      break;
  }

  return clone;
}

function withinConstraints(
  metrics: { tradeSpendPct: number },
  objective: { tradeSpendPctMin: number; tradeSpendPctMax: number }
): boolean {
  return (
    metrics.tradeSpendPct >= objective.tradeSpendPctMin &&
    metrics.tradeSpendPct <= objective.tradeSpendPctMax
  );
}

export async function runAgent(objectiveId: string): Promise<string> {
  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    include: { retailer: true },
  });
  if (!objective) throw new Error(`Objective ${objectiveId} not found`);

  const basePlan = await prisma.promotion.findMany({
    where: {
      period: objective.period,
      retailerId: objective.retailerId,
      status: "DRAFT",
    },
  });

  const plan: PromotionPlan[] = basePlan.map((p) => ({
    productId: p.productId,
    promoType: p.promoType,
    discountPct: Math.min(objective.maxDiscountPct, p.discountPct),
    displayFlag: p.displayFlag,
    featureFlag: p.featureFlag,
    startWeek: p.startWeek,
    durationWeeks: p.durationWeeks,
  }));

  const baselinesRaw = await prisma.baseline.findMany({
    where: { period: objective.period, retailerId: objective.retailerId },
    include: { product: true },
  });

  const baselines = baselinesRaw.map((b) => ({
    productId: b.productId,
    productName: b.product.name,
    week: b.week,
    baseUnits: b.baseUnits,
    basePrice: b.basePrice,
    baseCost: b.baseCost,
  }));

  const weeksInPeriod = objective.period.includes("Q") ? 13 : 4;

  let bestScenario: { plan: PromotionPlan[]; metrics: ReturnType<typeof calculateMetrics> } | null = null;
  let bestScore = -Infinity;
  const trace: Array<{ i: number; score: number; metrics: ReturnType<typeof calculateMetrics> }> = [];

  for (let i = 0; i < 1000; i++) {
    const mutatedPlan = plan.length > 0 ? mutatePlan(plan, objective) : plan;

    const sim = simulate({
      promotions: mutatedPlan,
      baselines,
      weeksInPeriod,
    });

    const metrics = calculateMetrics(sim);

    if (!withinConstraints(metrics, objective)) continue;

    const score = scoreScenario(metrics, {
      objectiveType: objective.objectiveType,
    });

    trace.push({ i, score, metrics });

    if (score > bestScore) {
      bestScore = score;
      bestScenario = { plan: mutatedPlan, metrics };
    }
  }

  const scenarioData = bestScenario ?? { plan, metrics: calculateMetrics(simulate({ promotions: plan, baselines, weeksInPeriod })) };

  const scenario = await prisma.scenario.create({
    data: {
      objectiveId,
      name: "Agent Recommended",
      planJson: scenarioData.plan as unknown as object,
      kpisJson: {
        incrementalMargin: scenarioData.metrics.incrementalMargin,
        roi: scenarioData.metrics.roi,
        tradeSpendPct: scenarioData.metrics.tradeSpendPct,
        risk: scenarioData.metrics.risk,
        confidence: scenarioData.metrics.confidence,
        totalRevenue: scenarioData.metrics.totalRevenue,
        totalUnits: scenarioData.metrics.totalUnits,
      } as unknown as object,
    },
  });

  await prisma.agentRun.create({
    data: {
      objectiveId,
      status: "COMPLETED",
      traceJson: trace.slice(0, 50) as unknown as object,
    },
  });

  return scenario.id;
}

/* ─── Budget allocation engine (for chat agent) ─── */
import type { BudgetEntry } from "./scenario";

export type Objective = "maximize_margin" | "maximize_revenue" | "balanced";

export interface AgenticConstraints {
  minSpendByRetailer?: Record<string, number>;
  maxSpendByRetailer?: Record<string, number>;
  maxShiftPct?: number;
  maxDiscountDepth?: number;
  includeRetailers?: string[];
  excludeRetailers?: string[];
}

export interface AgenticInput {
  periodStart: Date;
  periodEnd: Date;
  objective: Objective;
  constraints?: AgenticConstraints;
  baseAllocation: BudgetEntry[];
  responseCurve: Record<string, number>;
  retailerCoverage: { name: string; circanaCoverage: boolean }[];
  inventoryFlags: Record<string, "OK" | "LOW">;
  nSims?: number;
  seed?: number;
}

export interface ScenarioResult {
  allocation: Record<string, number>;
  incUnits: number;
  incMargin: number;
  roi: number;
  riskScore: number;
  confidenceScore: number;
  revenue: number;
  balancedScore: number;
}

export interface AgenticOutput {
  topScenario: ScenarioResult;
  top5Scenarios: ScenarioResult[];
  allScenariosCount: number;
  explanationBullets: string[];
  runtimeMs: number;
  seed: number;
  roiDistribution?: number[];
}

function generateSingleScenario(
  baseAllocation: BudgetEntry[],
  responseCurve: Record<string, number>,
  constraints: AgenticConstraints,
  rng: () => number
): Record<string, number> {
  const totalSpend = baseAllocation.reduce((s, b) => s + b.spend, 0);
  const baseByName = Object.fromEntries(baseAllocation.map((b) => [b.retailerName, b.spend]));
  const retailers = baseAllocation.map((b) => b.retailerName);
  const excluded = new Set(constraints.excludeRetailers ?? []);
  const maxShift = constraints.maxShiftPct ?? 0.3;

  const allocation: Record<string, number> = {};
  for (const r of retailers) {
    if (excluded.has(r)) {
      allocation[r] = baseByName[r] ?? 0;
      continue;
    }
    const base = baseByName[r] ?? 0;
    const shift = (rng() * 2 - 1) * maxShift * base;
    allocation[r] = Math.max(0, base + shift);
  }

  const sum = Object.values(allocation).reduce((a, b) => a + b, 0);
  const scale = sum > 0 ? totalSpend / sum : 1;
  for (const r of retailers) {
    allocation[r] = Math.round((allocation[r] ?? 0) * scale);
  }

  return allocation;
}

function computeScenarioMetrics(
  allocation: Record<string, number>,
  responseCurve: Record<string, number>,
  retailerCoverage: { name: string; circanaCoverage: boolean }[],
  inventoryFlags: Record<string, "OK" | "LOW">,
  retailerIdByName: Record<string, string>
): Omit<ScenarioResult, "allocation"> {
  const totalSpend = Object.values(allocation).reduce((a, b) => a + b, 0) || 1;
  let incMargin = 0;
  let revenue = 0;
  let confidenceSum = 0;
  let n = 0;
  let riskAcc = 0;

  for (const [name, spend] of Object.entries(allocation)) {
    const resp = responseCurve[name] ?? 0.12;
    incMargin += spend * resp;
    revenue += spend * 1.2;
    const cov = retailerCoverage.find((r) => r.name === name);
    const conf = cov?.circanaCoverage ? 0.9 : 0.5;
    const rid = retailerIdByName[name];
    const inv = inventoryFlags[rid ?? ""] ?? "OK";
    const confAdj = inv === "LOW" ? conf * 0.8 : conf;
    confidenceSum += confAdj;
    n++;
    riskAcc += !cov?.circanaCoverage ? 0.3 : 0;
  }

  const confidenceScore = n > 0 ? Math.min(1, confidenceSum / n) : 0.5;
  const riskScore = Math.min(1, riskAcc + (1 - confidenceScore) * 0.5);
  const incUnits = incMargin / 2.5;
  const roi = totalSpend > 0 ? incMargin / totalSpend : 0;
  const balancedScore = incMargin * 0.5 + revenue * 0.0001 + roi * 1000 - riskScore * 500;

  return {
    incUnits,
    incMargin,
    roi,
    riskScore,
    confidenceScore,
    revenue,
    balancedScore,
  };
}

function rankBudgetScenarios(
  scenarios: ScenarioResult[],
  objective: Objective
): ScenarioResult[] {
  return [...scenarios].sort((a, b) => {
    let cmp = 0;
    if (objective === "maximize_margin") cmp = b.incMargin - a.incMargin;
    else if (objective === "maximize_revenue") cmp = b.revenue - a.revenue;
    else cmp = b.balancedScore - a.balancedScore;
    if (cmp !== 0) return cmp;
    return a.riskScore - b.riskScore;
  });
}

export function runAgenticOptimization(input: AgenticInput): AgenticOutput {
  const start = performance.now();
  const seed = input.seed ?? 42;
  const nSims = input.nSims ?? 1000;
  const rng = createSeededRng(seed);
  const constraints = input.constraints ?? {};

  const retailerIdByName = Object.fromEntries(
    input.baseAllocation.map((b) => [b.retailerName, b.retailerId])
  );

  const scenarios: ScenarioResult[] = [];
  for (let i = 0; i < nSims; i++) {
    const allocation = generateSingleScenario(
      input.baseAllocation,
      input.responseCurve,
      constraints,
      rng
    );
    const metrics = computeScenarioMetrics(
      allocation,
      input.responseCurve,
      input.retailerCoverage,
      input.inventoryFlags,
      retailerIdByName
    );
    scenarios.push({ ...metrics, allocation });
  }

  const ranked = rankBudgetScenarios(scenarios, input.objective);
  const top = ranked[0];
  const top5 = ranked.slice(0, 5);

  return {
    topScenario: top,
    top5Scenarios: top5,
    allScenariosCount: scenarios.length,
    explanationBullets: ["Shift spend based on elasticity", "Data gaps on Walmart/Club"],
    runtimeMs: performance.now() - start,
    seed,
    roiDistribution: scenarios.map((s) => s.roi),
  };
}
