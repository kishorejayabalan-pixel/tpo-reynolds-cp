import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** KPI formulas per PromoEvent (with SKU joined):
 * units = promoUnits
 * netPrice = basePrice * (1 - discountDepth)
 * revenue = units * netPrice
 * spend = units * basePrice * discountDepth
 * cogs = units * unitCost
 * margin = revenue - cogs - spend  (or margin = revenue - cogs, spend is trade spend)
 * roi = margin / max(spend, 1)
 */
function computeEventKpis(
  promoUnits: number,
  basePrice: number,
  unitCost: number,
  discountDepth: number
): { revenue: number; spend: number; cogs: number; margin: number; roi: number } {
  const netPrice = basePrice * (1 - discountDepth);
  const revenue = promoUnits * netPrice;
  const spend = promoUnits * basePrice * discountDepth;
  const cogs = promoUnits * unitCost;
  const margin = revenue - cogs - spend;
  const roi = spend > 0 ? margin / spend : 0;
  return { revenue, spend, cogs, margin, roi };
}

const Q2_2026_START = new Date(2026, 3, 1); // April 1

function getWeekIndex(periodStart: Date): number {
  const ms = periodStart.getTime() - Q2_2026_START.getTime();
  return Math.max(0, Math.floor(ms / (7 * 24 * 60 * 60 * 1000)));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const retailerId = searchParams.get("retailerId") ?? undefined;
    const scenarioIdParam = searchParams.get("scenarioId");
    const weeks = Math.min(24, Math.max(1, parseInt(searchParams.get("weeks") ?? "12", 10) || 12));

    let scenarioId: string | null = scenarioIdParam ?? null;
    if (!scenarioId) {
      const baseline = await prisma.scenario.findFirst({
        where: { name: "Baseline Plan" },
        select: { id: true },
      });
      scenarioId = baseline?.id ?? null;
    }

    if (!scenarioId) {
      return NextResponse.json({
        revenueTrend: [],
        spendByMechanic: [],
        roiVsSpend: [],
        categoryMix: [],
      });
    }

    const events = await prisma.promoEvent.findMany({
      where: { scenarioId, ...(retailerId ? { retailerId } : {}) },
      include: { sku: true },
    });

    const weekLabels = Array.from({ length: weeks }, (_, i) => `W${i + 1}`);

    // revenueTrend: [{ week: "W1", revenue, margin }]
    const revenueByWeek = new Map<number, { revenue: number; margin: number }>();
    for (let w = 0; w < weeks; w++) revenueByWeek.set(w, { revenue: 0, margin: 0 });
    for (const e of events) {
      const wi = getWeekIndex(e.periodStart);
      if (wi >= weeks) continue;
      const k = computeEventKpis(e.promoUnits, e.sku.basePrice, e.sku.unitCost, e.discountDepth);
      const cur = revenueByWeek.get(wi)!;
      cur.revenue += k.revenue;
      cur.margin += k.margin;
    }
    const revenueTrend = weekLabels.map((week, i) => ({
      week,
      revenue: revenueByWeek.get(i)?.revenue ?? 0,
      margin: revenueByWeek.get(i)?.margin ?? 0,
    }));

    // spendByMechanic: [{ week: "W1", TPR, BOGO, Display, Feature, Seasonal, Clearance }]
    const mechanicKeys = ["TPR", "BOGO", "Display", "Feature", "Seasonal", "Clearance"] as const;
    const spendByWeekMechanic = new Map<number, Record<string, number>>();
    for (let w = 0; w < weeks; w++) {
      spendByWeekMechanic.set(w, { TPR: 0, BOGO: 0, Display: 0, Feature: 0, Seasonal: 0, Clearance: 0 });
    }
    for (const e of events) {
      const wi = getWeekIndex(e.periodStart);
      if (wi >= weeks) continue;
      const k = computeEventKpis(e.promoUnits, e.sku.basePrice, e.sku.unitCost, e.discountDepth);
      const mechanic = (e.promoType ?? "TPR") as (typeof mechanicKeys)[number];
      const row = spendByWeekMechanic.get(wi)!;
      row[mechanic] = (row[mechanic] ?? 0) + k.spend;
    }
    const spendByMechanic = weekLabels.map((week, i) => {
      const row = spendByWeekMechanic.get(i) ?? {};
      return { week, ...row };
    });

    // roiVsSpend: [{ promoEventId, skuName, promoType, roi, spend, margin }]
    const skuName = (s: { name?: string; skuCode: string; brand: string }) =>
      (s as { name?: string }).name?.trim() ? (s as { name: string }).name : `${(s as { brand: string }).brand} · ${(s as { skuCode: string }).skuCode}`;
    const roiVsSpend = events.map((e) => {
      const k = computeEventKpis(e.promoUnits, e.sku.basePrice, e.sku.unitCost, e.discountDepth);
      return {
        promoEventId: e.id,
        skuName: skuName(e.sku),
        promoType: e.promoType ?? "None",
        roi: k.roi,
        spend: k.spend,
        margin: k.margin,
      };
    });

    // categoryMix: [{ category, revenue, spend, margin }]
    const categoryMap = new Map<string, { revenue: number; spend: number; margin: number }>();
    for (const e of events) {
      const k = computeEventKpis(e.promoUnits, e.sku.basePrice, e.sku.unitCost, e.discountDepth);
      const cat = e.sku.category;
      if (!categoryMap.has(cat)) categoryMap.set(cat, { revenue: 0, spend: 0, margin: 0 });
      const cur = categoryMap.get(cat)!;
      cur.revenue += k.revenue;
      cur.spend += k.spend;
      cur.margin += k.margin;
    }
    const categoryMix = Array.from(categoryMap.entries()).map(([category, v]) => ({
      category,
      revenue: v.revenue,
      spend: v.spend,
      margin: v.margin,
    }));

    return NextResponse.json({
      revenueTrend,
      spendByMechanic,
      roiVsSpend,
      categoryMix,
    });
  } catch (e) {
    console.error("GET /api/dashboard/charts", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Charts failed" },
      { status: 500 }
    );
  }
}
