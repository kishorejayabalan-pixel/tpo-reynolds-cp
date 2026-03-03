import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { simulate } from "@/lib/tpo/simulate";
import type { SimPromoEvent, SimSKU, SimRetailer } from "@/lib/tpo/simulate";
import { periodToDateRange } from "@/lib/repo/tpoRepo";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") ?? "2026-Q2";
    const horizonWeeks = parseInt(searchParams.get("horizonWeeks") ?? "12", 10);
    const retailerId = searchParams.get("retailerId") ?? undefined;

    const { start } = periodToDateRange(period);
    const end = new Date(start);
    end.setDate(end.getDate() + horizonWeeks * 7);

    const retailers = await prisma.retailer.findMany({
      where: retailerId ? { id: retailerId } : undefined,
      select: { id: true, name: true },
    });

    const kpis: {
      retailerId: string;
      retailerName: string;
      revenue: number;
      units: number;
      margin: number;
      spend: number;
      roi: number;
      stockoutRisk: number;
    }[] = [];

    for (const retailer of retailers) {
      const eventsRaw = await prisma.promoEvent.findMany({
        where: {
          retailerId: retailer.id,
          periodStart: { lte: end },
          periodEnd: { gte: start },
        },
        include: { sku: true },
      });
      const skusRaw = await prisma.sKU.findMany({ orderBy: { skuCode: "asc" } });

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

      const kpi = simulate({
        events,
        skus,
        retailer: retailerSim,
        horizonWeeks,
        seed: 42,
        nDraws: 200,
      });
      kpis.push({
        retailerId: retailer.id,
        retailerName: retailer.name,
        revenue: kpi.revenue,
        units: kpi.units,
        margin: kpi.margin,
        spend: kpi.spend,
        roi: kpi.roi,
        stockoutRisk: kpi.stockoutRisk,
      });
    }

    const aggregate =
      kpis.length > 0
        ? {
            revenue: kpis.reduce((s, k) => s + k.revenue, 0),
            units: kpis.reduce((s, k) => s + k.units, 0),
            margin: kpis.reduce((s, k) => s + k.margin, 0),
            spend: kpis.reduce((s, k) => s + k.spend, 0),
            roi:
              kpis.reduce((s, k) => s + k.spend, 0) > 0
                ? kpis.reduce((s, k) => s + k.margin, 0) /
                  kpis.reduce((s, k) => s + k.spend, 0)
                : 0,
            stockoutRisk:
              kpis.reduce((s, k) => s + k.stockoutRisk, 0) / kpis.length,
          }
        : null;

    return NextResponse.json({
      period,
      horizonWeeks,
      kpis,
      aggregate,
    });
  } catch (e) {
    console.error("GET /api/kpis", e);
    return NextResponse.json(
      { error: "Failed to compute KPIs" },
      { status: 500 }
    );
  }
}
