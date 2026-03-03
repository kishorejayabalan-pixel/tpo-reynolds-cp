/**
 * TPO Simulation — fetches baselines and calls pure simulate()
 */
import { prisma } from "./db";
import { simulate, type PromotionPlan } from "./tpo/reynoldsSimulation";

export type { PromotionPlan };

export interface SimulatorKPIs {
  totalRevenue: number;
  totalMargin: number;
  incrementalMargin: number;
  tradeSpendPct: number;
  roi: number;
  risk: number;
  confidence: number;
  totalUnits: number;
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

export async function simulatePlan(
  period: string,
  retailerId: string,
  promotions: PromotionPlan[]
): Promise<SimulatorKPIs> {
  const weeksInPeriod = period.includes("Q")
    ? 13
    : period.split("-").length >= 2
      ? 4
      : 52;

  const baselinesRaw = await prisma.baseline.findMany({
    where: { period, retailerId },
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

  const result = simulate({ promotions, baselines, weeksInPeriod });

  return {
    totalRevenue: result.totalRevenue,
    totalMargin: result.totalMargin,
    incrementalMargin: result.incrementalMargin,
    tradeSpendPct: result.tradeSpendPct,
    roi: result.roi,
    risk: result.risk,
    confidence: result.confidence,
    totalUnits: result.totalUnits,
    breakdown: result.breakdown,
  };
}
