import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MECHANICS = ["TPR", "BOGO", "Display", "Feature", "All Price Off"] as const;

function weekIndexToPeriod(weekIndex: number): { start: Date; end: Date } {
  const start = new Date(2026, 2, 1); // 1 Apr 2026 = Q2 start
  start.setDate(start.getDate() + weekIndex * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

/**
 * POST: Add a promotion to a scenario.
 * Body: { retailerId: string; skuId: string; weekIndex: number (0-11); mechanic: string; discountPct: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scenarioId } = await params;
    const body = (await req.json()) as {
      retailerId: string;
      skuId: string;
      weekIndex: number;
      mechanic: string;
      discountPct: number;
    };
    const { retailerId, skuId, weekIndex, mechanic, discountPct } = body;
    if (!retailerId || !skuId || weekIndex == null || weekIndex < 0 || weekIndex > 11) {
      return NextResponse.json(
        { error: "retailerId, skuId, and weekIndex (0-11) required" },
        { status: 400 }
      );
    }

    const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    const { start: periodStart, end: periodEnd } = weekIndexToPeriod(weekIndex);
    const discountDepth = Math.min(0.5, Math.max(0, (discountPct ?? 15) / 100));
    const mechanicType = MECHANICS.includes(mechanic as (typeof MECHANICS)[number]) ? mechanic : "TPR";
    const baselineUnits = 10000;
    const promoUnits = Math.round(baselineUnits * (1 + (mechanicType === "BOGO" ? 1 : 0.3)));

    const event = await prisma.promoEvent.create({
      data: {
        scenarioId,
        retailerId,
        skuId,
        periodStart,
        periodEnd,
        discountDepth,
        durationWeeks: 1,
        baselineUnits,
        promoUnits,
        inventoryFlag: "OK",
        promoType: mechanicType,
        displaySupport: mechanicType === "Display" || mechanicType === "Feature",
        featureAd: mechanicType === "Feature",
      },
    });

    return NextResponse.json({ promoEvent: { id: event.id } });
  } catch (e) {
    console.error("POST /api/scenarios/workspace/[id]/promo-events", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add promotion" },
      { status: 500 }
    );
  }
}
