import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

    const events = await prisma.promoEvent.findMany({
      where: {
        ...(retailerId ? { retailerId } : {}),
        periodStart: { lte: end },
        periodEnd: { gte: start },
      },
      include: { retailer: true, sku: true },
      orderBy: [{ retailerId: "asc" }, { periodStart: "asc" }],
    });

    const weekStart = new Date(start);
    const eventsByRetailerWeek: Record<
      string,
      Record<number, { promoType: string; discountDepth: number; skuCode: string }[]>
    > = {};

    for (const e of events) {
      const rName = e.retailer.name;
      if (!eventsByRetailerWeek[rName]) eventsByRetailerWeek[rName] = {};
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const weekIndex = Math.floor(
        (e.periodStart.getTime() - weekStart.getTime()) / weekMs
      );
      const w = Math.max(0, weekIndex);
      if (!eventsByRetailerWeek[rName][w])
        eventsByRetailerWeek[rName][w] = [];
      eventsByRetailerWeek[rName][w].push({
        promoType: e.promoType ?? "TPR",
        discountDepth: e.discountDepth,
        skuCode: e.sku.skuCode,
      });
    }

    return NextResponse.json({
      period,
      horizonWeeks,
      events: events.map((e) => ({
        id: e.id,
        retailerId: e.retailerId,
        retailerName: e.retailer.name,
        skuId: e.skuId,
        skuCode: e.sku.skuCode,
        periodStart: e.periodStart.toISOString(),
        periodEnd: e.periodEnd.toISOString(),
        promoType: e.promoType,
        discountDepth: e.discountDepth,
        durationWeeks: e.durationWeeks,
      })),
      byRetailerWeek: eventsByRetailerWeek,
    });
  } catch (e) {
    console.error("GET /api/promo-events", e);
    return NextResponse.json(
      { error: "Failed to load promo events" },
      { status: 500 }
    );
  }
}
