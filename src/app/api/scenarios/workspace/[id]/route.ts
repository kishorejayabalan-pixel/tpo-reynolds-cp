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
    return NextResponse.json({
      scenario: {
        id: scenario.id,
        name: scenario.name,
        status: scenario.status,
        objectiveJson: scenario.objectiveJson as Record<string, unknown> | null,
        kpiSummary: scenario.kpiSummary as Record<string, unknown> | null,
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
