/**
 * Multi-Agent Orchestrator — Human (Copilot) and Agent (Autopilot) modes
 */
import { prisma } from "@/lib/db";
import { createSeededRng } from "../seededRng";
import { simulate, type PromotionPlan, type BaselineRow } from "../reynoldsSimulation";
import { calculateMetrics } from "../metrics";
import { scoreScenario, meetsTargets } from "../optimizer";
import { runStrategistAgent } from "../agents/strategistAgent";
import { runCalendarAgent } from "../agents/calendarAgent";
import { runRiskAgent } from "../agents/riskAgent";
import { runQuantAgent } from "../agents/quantAgent";
import { runNarratorAgent } from "../agents/narratorAgent";
import { generateInitialPlan } from "../agents/userProxyAgent";
import type { MetricResult } from "../metrics";

export type OrchestratorMode = "HUMAN" | "AGENT";

export interface TargetJson {
  targetRevenue?: number;
  targetMargin?: number;
  maxDiscountPct?: number;
  spendPctMin?: number;
  spendPctMax?: number;
}

function runCandidateSearch(
  basePlan: PromotionPlan[],
  baselines: BaselineRow[],
  weeksInPeriod: number,
  spec: ReturnType<typeof runStrategistAgent>,
  targetJson: TargetJson | undefined,
  nCandidates: number,
  rng: () => number
): {
  candidates: Array<{ plan: PromotionPlan[]; metrics: MetricResult; score: number }>;
  rejectedRisk: number;
  rejectedQuant: number;
} {
  const objectiveConstraints = {
    objectiveType: spec.objectiveType,
    tradeSpendPctMin: spec.guardrails.tradeSpendPctMin,
    tradeSpendPctMax: spec.guardrails.tradeSpendPctMax,
    maxDiscountPct: spec.guardrails.maxDiscountPct,
    targetRevenue: targetJson?.targetRevenue,
    targetMargin: targetJson?.targetMargin,
  };

  const candidates: Array<{ plan: PromotionPlan[]; metrics: MetricResult; score: number }> = [];
  let rejectedRisk = 0;
  let rejectedQuant = 0;

  for (let i = 0; i < nCandidates; i++) {
    const candidate = basePlan.length > 0 ? runCalendarAgent(basePlan, spec, rng) : basePlan;
    const risk = runRiskAgent(candidate, spec);
    if (!risk.pass) {
      rejectedRisk++;
      continue;
    }

    const quant = runQuantAgent(candidate, baselines, spec, weeksInPeriod);
    if (!quant.pass) {
      rejectedQuant++;
      continue;
    }

    const score = scoreScenario(quant.metrics, objectiveConstraints);
    candidates.push({ plan: candidate, metrics: quant.metrics, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return { candidates, rejectedRisk, rejectedQuant };
}

function adjustStrategyForTarget(
  plan: PromotionPlan[],
  products: Array<{ productId: string }>,
  spec: ReturnType<typeof runStrategistAgent>,
  rng: () => number
): PromotionPlan[] {
  const clone = plan.map((p) => ({ ...p }));

  const choice = Math.floor(rng() * 3);
  if (choice === 0 && clone.length < 14) {
    const productId = products[Math.floor(rng() * products.length)]?.productId;
    if (productId) {
      clone.push({
        productId,
        promoType: Math.random() < 0.5 ? "DISPLAY" : "FEATURE",
        discountPct: Math.min(spec.guardrails.maxDiscountPct, 0.15),
        displayFlag: true,
        featureFlag: false,
        startWeek: Math.floor(rng() * 8),
        durationWeeks: 2 + Math.floor(rng() * 2),
      });
    }
  } else if (choice === 1) {
    const idx = Math.floor(rng() * clone.length);
    const p = clone[idx];
    if (p) {
      if (!p.displayFlag && !p.featureFlag) {
        p.displayFlag = true;
      } else if (!p.featureFlag) {
        p.featureFlag = true;
      }
    }
  } else {
    const idx = Math.floor(rng() * clone.length);
    const p = clone[idx];
    if (p && p.discountPct < spec.guardrails.maxDiscountPct) {
      p.discountPct = Math.min(
        spec.guardrails.maxDiscountPct,
        p.discountPct + 0.02
      );
    }
  }

  return clone;
}

export async function runHumanOptimization(
  objectiveId: string,
  nCandidates = 1000,
  seed = 42
): Promise<string> {
  return runOptimization(objectiveId, {
    mode: "HUMAN",
    targetJson: undefined,
    nCandidates,
    seed,
  });
}

export async function runAgentOptimization(
  objectiveId: string,
  targetJson: TargetJson,
  nCandidates = 1000,
  maxRounds = 5,
  seed = 42
): Promise<string> {
  return runOptimization(objectiveId, {
    mode: "AGENT",
    targetJson,
    nCandidates,
    maxRounds,
    seed,
  });
}

interface RunOptions {
  mode: OrchestratorMode;
  targetJson?: TargetJson;
  nCandidates?: number;
  maxRounds?: number;
  seed?: number;
}

async function runOptimization(
  objectiveId: string,
  options: RunOptions
): Promise<string> {
  const {
    mode,
    targetJson,
    nCandidates = 1000,
    maxRounds = 1,
    seed = 42,
  } = options;

  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    include: { retailer: true },
  });
  if (!objective) throw new Error(`Objective ${objectiveId} not found`);

  const baselinesRaw = await prisma.baseline.findMany({
    where: { period: objective.period, retailerId: objective.retailerId },
    include: { product: true },
  });

  const baselines: BaselineRow[] = baselinesRaw.map((b) => ({
    productId: b.productId,
    productName: b.product.name,
    week: b.week,
    baseUnits: b.baseUnits,
    basePrice: b.basePrice,
    baseCost: b.baseCost,
  }));

  const products = [...new Map(baselines.map((b) => [b.productId, { productId: b.productId }])).values()];
  const weeksInPeriod = objective.period.includes("Q") ? 13 : 4;

  const spec = runStrategistAgent({
    objectiveType: objective.objectiveType,
    maxDiscountPct: objective.maxDiscountPct,
    tradeSpendPctMin: objective.tradeSpendPctMin,
    tradeSpendPctMax: objective.tradeSpendPctMax,
  });

  const objectiveConstraints = {
    objectiveType: spec.objectiveType,
    tradeSpendPctMin: spec.guardrails.tradeSpendPctMin,
    tradeSpendPctMax: spec.guardrails.tradeSpendPctMax,
    maxDiscountPct: spec.guardrails.maxDiscountPct,
    targetRevenue: targetJson?.targetRevenue,
    targetMargin: targetJson?.targetMargin,
  };

  let basePlan: PromotionPlan[];
  if (mode === "HUMAN") {
    const promotions = await prisma.promotion.findMany({
      where: {
        period: objective.period,
        retailerId: objective.retailerId,
        status: "DRAFT",
      },
    });
    basePlan = promotions.map((p) => ({
      productId: p.productId,
      promoType: p.promoType,
      discountPct: Math.min(objective.maxDiscountPct, p.discountPct),
      displayFlag: p.displayFlag,
      featureFlag: p.featureFlag,
      startWeek: p.startWeek,
      durationWeeks: p.durationWeeks,
    }));
  } else {
    basePlan = generateInitialPlan({
      period: objective.period,
      retailerId: objective.retailerId,
      products,
      constraints: {
        maxDiscountPct: objective.maxDiscountPct,
        spendPctMin: objective.tradeSpendPctMin,
        spendPctMax: objective.tradeSpendPctMax,
      },
      targetRevenue: targetJson?.targetRevenue,
      targetMargin: targetJson?.targetMargin,
      objectiveType: objective.objectiveType,
      startWeek: 15,
      endWeek: 28,
    });
  }

  const baseSim = simulate({
    promotions: basePlan,
    baselines,
    weeksInPeriod,
  });
  const baseMetrics = calculateMetrics(baseSim);

  const rng = createSeededRng(seed);
  const rounds: Array<{
    round: number;
    basePlanCount: number;
    candidatesEvaluated: number;
    candidatesPassed: number;
    rejectedRisk: number;
    rejectedQuant: number;
    bestScore: number;
    bestRevenue: number;
    bestMargin: number;
    targetsMet: boolean;
  }> = [];

  let roundPlan = basePlan;
  let bestPlan = basePlan;
  let bestMetrics = baseMetrics;
  let bestScore = scoreScenario(baseMetrics, objectiveConstraints);
  let totalRejectedRisk = 0;
  let totalRejectedQuant = 0;
  let totalCandidates = 0;

  for (let r = 0; r < maxRounds; r++) {
    const { candidates, rejectedRisk, rejectedQuant } = runCandidateSearch(
      roundPlan,
      baselines,
      weeksInPeriod,
      spec,
      targetJson,
      nCandidates,
      rng
    );

    totalRejectedRisk += rejectedRisk;
    totalRejectedQuant += rejectedQuant;
    totalCandidates += candidates.length + rejectedRisk + rejectedQuant;

    const best = candidates[0];
    const targetsMet = targetJson
      ? meetsTargets(best?.metrics ?? bestMetrics, objectiveConstraints)
      : true;

    rounds.push({
      round: r + 1,
      basePlanCount: roundPlan.length,
      candidatesEvaluated: nCandidates,
      candidatesPassed: candidates.length,
      rejectedRisk,
      rejectedQuant,
      bestScore: best?.score ?? bestScore,
      bestRevenue: best?.metrics.totalRevenue ?? bestMetrics.totalRevenue,
      bestMargin: best?.metrics.totalMargin ?? bestMetrics.totalMargin,
      targetsMet,
    });

    if (best && best.score > bestScore) {
      bestPlan = best.plan;
      bestMetrics = best.metrics;
      bestScore = best.score;
    }

    if (mode === "AGENT" && targetJson && targetsMet) break;
    if (mode === "AGENT" && r < maxRounds - 1) {
      roundPlan = adjustStrategyForTarget(bestPlan, products, spec, rng);
    } else {
      break;
    }
  }

  const narrator = runNarratorAgent(baseMetrics, bestMetrics, basePlan, bestPlan);

  const scenario = await prisma.objectiveScenario.create({
    data: {
      objectiveId,
      name: mode === "HUMAN" ? "Multi-Agent Recommended" : "Autopilot Recommended",
      planJson: bestPlan as unknown as object,
      kpisJson: {
        base: {
          incrementalMargin: baseMetrics.incrementalMargin,
          roi: baseMetrics.roi,
          tradeSpendPct: baseMetrics.tradeSpendPct,
          totalUnits: baseMetrics.totalUnits,
          totalRevenue: baseMetrics.totalRevenue,
          totalMargin: baseMetrics.totalMargin,
        },
        recommended: {
          incrementalMargin: bestMetrics.incrementalMargin,
          roi: bestMetrics.roi,
          tradeSpendPct: bestMetrics.tradeSpendPct,
          totalUnits: bestMetrics.totalUnits,
          totalRevenue: bestMetrics.totalRevenue,
          totalMargin: bestMetrics.totalMargin,
        },
        delta: narrator.deltas,
        incrementalMargin: bestMetrics.incrementalMargin,
        roi: bestMetrics.roi,
        confidence: bestMetrics.confidence,
        tradeSpendPct: bestMetrics.tradeSpendPct,
        risk: bestMetrics.risk,
        totalUnits: bestMetrics.totalUnits,
        totalRevenue: bestMetrics.totalRevenue,
        totalMargin: bestMetrics.totalMargin,
        explanation: narrator.executiveSummary,
        topChanges: narrator.topChanges,
        runSummary: {
          candidatesEvaluated: totalCandidates,
          candidatesPassed: totalCandidates - totalRejectedRisk - totalRejectedQuant,
          top5Scores: [],
          rounds,
          rejectedRisk: totalRejectedRisk,
          rejectedQuant: totalRejectedQuant,
        },
      } as unknown as object,
      mode,
      targetJson: targetJson ?? undefined,
    },
  });

  await prisma.agentRun.create({
    data: {
      objectiveId,
      status: "COMPLETED",
      traceJson: {
        mode,
        rounds,
        candidateLeaderboard: [],
        candidatesEvaluated: totalCandidates,
        rejectedRisk: totalRejectedRisk,
        rejectedQuant: totalRejectedQuant,
        top5: [],
        narrator: {
          executiveSummary: narrator.executiveSummary,
          topChanges: narrator.topChanges,
        },
      } as unknown as object,
    },
  });

  return scenario.id;
}

export async function runMultiAgentOptimization(
  objectiveId: string,
  nCandidates = 1000,
  seed = 42
): Promise<string> {
  return runHumanOptimization(objectiveId, nCandidates, seed);
}
