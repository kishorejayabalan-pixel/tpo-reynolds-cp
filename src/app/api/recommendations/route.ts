import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/recommendations?scenarioId=&retailerId= - Top 5 rule-based recommendations */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scenarioId = searchParams.get("scenarioId") ?? undefined;
    const retailerId = searchParams.get("retailerId") ?? undefined;

    const recommendations: Array<{
      id: string;
      title: string;
      rationale: string;
      expectedImpact: { revenueDelta: number; roiDelta: number; spendDelta: number; riskDelta: number };
      actions: { simulate: boolean; apply: boolean; viewDiff: boolean };
    }> = [];

    const recentSignals = await prisma.signalTick.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const competitorDrop = recentSignals.find((s) => s.type === "competitor_drop");
    if (competitorDrop) {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(competitorDrop.payload) as Record<string, unknown>;
      } catch {}
      const category = (payload.category as string) ?? "category";
      const weeks = (payload.weeks as number[]) ?? [6, 7];
      recommendations.push({
        id: "rec-competitor-1",
        title: `Defend share in ${category} W${weeks[0] ?? 6}–W${weeks[1] ?? 7}`,
        rationale: `Competitor index drop detected. Recommend deeper discount or add feature in affected weeks to defend share.`,
        expectedImpact: { revenueDelta: 0.02, roiDelta: 0.05, spendDelta: 0.1, riskDelta: 0.02 },
        actions: { simulate: true, apply: true, viewDiff: true },
      });
    }

    const inventoryDelay = recentSignals.find((s) => s.type === "inventory_delay");
    if (inventoryDelay) {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(inventoryDelay.payload) as Record<string, unknown>;
      } catch {}
      const skuCode = (payload.skuCode as string) ?? "SKU";
      const delayWeeks = (payload.delayWeeks as number) ?? 2;
      recommendations.push({
        id: "rec-inventory-1",
        title: `Shift ${skuCode} promo by ${delayWeeks} week(s)`,
        rationale: "Inventory delay signal. Recommend shifting promo weeks later or reducing discount depth to avoid stockout.",
        expectedImpact: { revenueDelta: -0.01, roiDelta: 0.03, spendDelta: -0.05, riskDelta: -0.08 },
        actions: { simulate: true, apply: true, viewDiff: true },
      });
    }

    const demandSpike = recentSignals.find((s) => s.type === "demand_spike");
    if (demandSpike) {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(demandSpike.payload) as Record<string, unknown>;
      } catch {}
      const category = (payload.category as string) ?? "category";
      recommendations.push({
        id: "rec-demand-1",
        title: `Capture demand spike in ${category}`,
        rationale: "Demand spike detected. Recommend increasing feature/display support in affected weeks to capture lift.",
        expectedImpact: { revenueDelta: 0.05, roiDelta: 0.02, spendDelta: 0.08, riskDelta: 0.03 },
        actions: { simulate: true, apply: true, viewDiff: true },
      });
    }

    let scenarioIdResolved = scenarioId ?? null;
    if (!scenarioIdResolved) {
      const baseline = await prisma.scenario.findFirst({
        where: { name: "Baseline Plan" },
        select: { id: true },
      });
      scenarioIdResolved = baseline?.id ?? null;
    }
    if (scenarioIdResolved) {
      const events = await prisma.promoEvent.findMany({
        where: { scenarioId: scenarioIdResolved, ...(retailerId ? { retailerId } : {}) },
        include: { sku: true },
      });
      let totalSpend = 0;
      let totalMargin = 0;
      const roiFloor = 1.2;
      for (const e of events) {
        const spend = e.promoUnits * e.sku.basePrice * e.discountDepth;
        const revenue = e.promoUnits * e.sku.basePrice * (1 - e.discountDepth);
        const cogs = e.promoUnits * e.sku.unitCost;
        totalSpend += spend;
        totalMargin += revenue - cogs - spend;
      }
      const roiCurrent = totalSpend > 0 ? totalMargin / totalSpend : 0;
      if (roiCurrent < roiFloor && recommendations.length < 5) {
        recommendations.push({
          id: "rec-roi-1",
          title: "Improve ROI above floor",
          rationale: `Current ROI (${roiCurrent.toFixed(2)}) is below floor (${roiFloor}). Recommend swapping low-ROI mechanics or reallocating spend.`,
          expectedImpact: { revenueDelta: 0, roiDelta: 0.15, spendDelta: -0.05, riskDelta: -0.02 },
          actions: { simulate: true, apply: true, viewDiff: true },
        });
      }
      const lowInventoryCount = events.filter((e) => e.inventoryFlag === "LOW").length;
      if (lowInventoryCount > 5 && recommendations.length < 5) {
        recommendations.push({
          id: "rec-stockout-1",
          title: "Reduce stockout exposure",
          rationale: `${lowInventoryCount} events flagged LOW inventory. Recommend reducing depth or shifting promos.`,
          expectedImpact: { revenueDelta: -0.02, roiDelta: 0.05, spendDelta: -0.08, riskDelta: -0.12 },
          actions: { simulate: true, apply: true, viewDiff: true },
        });
      }
    }

    const top5 = recommendations.slice(0, 5);
    return NextResponse.json({ recommendations: top5 });
  } catch (e) {
    console.error("GET /api/recommendations", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load recommendations" },
      { status: 500 }
    );
  }
}
