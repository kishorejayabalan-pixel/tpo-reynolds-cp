import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSkuDisplayName } from "@/lib/skuDisplayNames";

/** GET: single workspace scenario with promo events and SKUs */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!prisma.scenario) {
      return NextResponse.json(
        { error: "Scenario model not available" },
        { status: 500 }
      );
    }
    const scenario = await prisma.scenario.findUnique({
      where: { id },
      include: {
        promoEvents: { include: { sku: true, retailer: true } },
      },
    });
    if (!scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }
    const kpiBase = (scenario.kpiSummary as Record<string, unknown> | null) ?? {};
    const kpi = { ...kpiBase };
    const hasVolume = kpi.volume != null;
    const hasSpend = kpi.spend != null;
    if ((!hasVolume || !hasSpend) && scenario.promoEvents.length > 0) {
      const volume = scenario.promoEvents.reduce((s, e) => s + e.promoUnits, 0);
      const spend = scenario.promoEvents.reduce((s, e) => s + e.baselineUnits * 0.5 * (1 + e.discountDepth), 0);
      if (!hasVolume) kpi.volume = volume;
      if (!hasSpend) kpi.spend = Math.round(spend);
    }
    return NextResponse.json({
      scenario: {
        id: scenario.id,
        name: scenario.name,
        status: scenario.status,
        objectiveJson: scenario.objectiveJson as Record<string, unknown> | null,
        kpiSummary: kpi,
        createdAt: scenario.createdAt.toISOString(),
        updatedAt: scenario.updatedAt.toISOString(),
        promoEvents: scenario.promoEvents.map((e) => ({
          id: e.id,
          retailerId: e.retailerId,
          retailerName: e.retailer.name,
          skuId: e.skuId,
          skuCode: e.sku.skuCode,
          skuDisplayName: getSkuDisplayName(e.sku.skuCode, e.sku.brand, (e.sku as { name?: string }).name),
          category: e.sku.category,
          periodStart: e.periodStart.toISOString(),
          periodEnd: e.periodEnd.toISOString(),
          discountDepth: e.discountDepth,
          durationWeeks: e.durationWeeks,
          promoType: e.promoType,
          displaySupport: e.displaySupport,
          featureAd: e.featureAd,
          baselineUnits: e.baselineUnits,
          promoUnits: e.promoUnits,
          inventoryFlag: e.inventoryFlag,
          agentReason: (e as { agentReason?: string | null }).agentReason ?? null,
        })),
      },
    });
  } catch (e) {
    console.error("GET /api/scenarios/workspace/[id]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load scenario" },
      { status: 500 }
    );
  }
}
