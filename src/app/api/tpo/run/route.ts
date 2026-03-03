import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { optimize } from "@/lib/tpo/optimize";
import type { SimPromoEvent, SimSKU, SimRetailer } from "@/lib/tpo/simulate";
import { periodToDateRange } from "@/lib/repo/tpoRepo";

const defaultPeriod = "2026-Q2";
const defaultHorizonWeeks = 12;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      retailerId?: string;
      period?: string;
      horizonWeeks?: number;
      budget?: number;
      inventoryBySku?: Record<string, number>;
    };

    const retailerId = body.retailerId;
    if (!retailerId) {
      return NextResponse.json(
        { error: "retailerId is required" },
        { status: 400 }
      );
    }

    const period = body.period ?? defaultPeriod;
    const horizonWeeks = body.horizonWeeks ?? defaultHorizonWeeks;
    const { start, end } = periodToDateRange(period);
    const horizonEnd = new Date(start);
    horizonEnd.setDate(horizonEnd.getDate() + horizonWeeks * 7);

    const [retailer, eventsRaw, skusRaw] = await Promise.all([
      prisma.retailer.findUnique({ where: { id: retailerId } }),
      prisma.promoEvent.findMany({
        where: {
          retailerId,
          periodStart: { lte: horizonEnd },
          periodEnd: { gte: start },
        },
        include: { sku: true },
      }),
      prisma.sKU.findMany({ orderBy: { skuCode: "asc" } }),
    ]);

    if (!retailer) {
      return NextResponse.json(
        { error: "Retailer not found" },
        { status: 404 }
      );
    }

    const budgetRow = await prisma.budget.findFirst({
      where: { retailerId, period },
    });
    const budget = body.budget ?? budgetRow?.spend ?? 5_000_000;

    const events: SimPromoEvent[] = eventsRaw.map((e) => ({
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

    const skus: SimSKU[] = skusRaw.map((s) => ({
      id: s.id,
      skuCode: s.skuCode,
      category: s.category,
      brand: s.brand,
      unitCost: s.unitCost,
      basePrice: s.basePrice,
    }));

    const retailerSim: SimRetailer = { id: retailer.id, name: retailer.name };

    const result = optimize({
      events,
      skus,
      retailer: retailerSim,
      horizonWeeks,
      budget,
      inventoryBySku: body.inventoryBySku,
    });

    return NextResponse.json({
      bestPlan: result.bestPlan
        ? {
            plan: result.bestPlan.plan.map((e) => ({
              retailerId: e.retailerId,
              skuId: e.skuId,
              periodStart: e.periodStart.toISOString(),
              periodEnd: e.periodEnd.toISOString(),
              discountDepth: e.discountDepth,
              durationWeeks: e.durationWeeks,
              baselineUnits: e.baselineUnits,
              promoType: e.promoType,
            })),
            kpi: result.bestPlan.kpi,
          }
        : null,
      top5: result.top5.map((p) => ({
        plan: p.plan.map((e) => ({
          retailerId: e.retailerId,
          skuId: e.skuId,
          periodStart: e.periodStart.toISOString(),
          periodEnd: e.periodEnd.toISOString(),
          discountDepth: e.discountDepth,
          durationWeeks: e.durationWeeks,
        })),
        kpi: p.kpi,
      })),
      feasibleCount: result.feasibleCount,
      totalCandidates: result.totalCandidates,
    });
  } catch (e) {
    console.error("POST /api/tpo/run", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Optimization failed" },
      { status: 500 }
    );
  }
}
