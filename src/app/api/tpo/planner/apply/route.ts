/**
 * Apply scenario plan to promotions (archive old, create new APPLIED)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { scenarioId?: string };
    const { scenarioId } = body;
    if (!scenarioId) {
      return NextResponse.json(
        { error: "scenarioId is required" },
        { status: 400 }
      );
    }
    const scenario = await prisma.objectiveScenario.findUnique({
      where: { id: scenarioId },
      include: { objective: true },
    });
    if (!scenario) {
      return NextResponse.json(
        { error: "Scenario not found" },
        { status: 404 }
      );
    }
    const plan = scenario.planJson as Array<{
      productId: string;
      promoType: string;
      discountPct: number;
      displayFlag: boolean;
      featureFlag: boolean;
      startWeek: number;
      durationWeeks: number;
    }>;
    const { period, retailerId } = scenario.objective;

    await prisma.promotion.updateMany({
      where: { period, retailerId },
      data: { status: "ARCHIVED" },
    });

    let applied = 0;
    if (Array.isArray(plan) && plan.length > 0) {
      await prisma.promotion.createMany({
        data: plan.map((p) => ({
          period,
          retailerId,
          productId: p.productId,
          promoType: p.promoType,
          discountPct: p.discountPct ?? 0.1,
          displayFlag: p.displayFlag ?? false,
          featureFlag: p.featureFlag ?? false,
          startWeek: p.startWeek,
          durationWeeks: p.durationWeeks,
          status: "APPLIED",
        })),
      });
      applied = plan.length;
    }

    return NextResponse.json({ ok: true, applied });
  } catch (e) {
    console.error("Apply error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Apply failed" },
      { status: 500 }
    );
  }
}
