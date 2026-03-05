import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPromoEventsInRange, periodToDateRange } from "@/lib/repo/tpoRepo";

const DEFAULT_PERIOD = "2026-Q2";

/**
 * POST: Clone a scenario, apply optimization, save as new Scenario with status AGENT_GENERATED.
 * If the source scenario has no promo events, uses global baseline (promo events in period) so the calendar is populated.
 * Body: { sourceScenarioId: string; name?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { sourceScenarioId?: string; name?: string };
    const sourceScenarioId = body.sourceScenarioId;
    if (!sourceScenarioId) {
      return NextResponse.json(
        { error: "sourceScenarioId required" },
        { status: 400 }
      );
    }

    const source = await prisma.scenario.findUnique({
      where: { id: sourceScenarioId },
      include: { promoEvents: { include: { sku: true, retailer: true } } },
    });
    if (!source) {
      return NextResponse.json({ error: "Source scenario not found" }, { status: 404 });
    }

    const name = body.name ?? `Agent Plan – ${new Date().toLocaleDateString()}`;

    let eventsToClone = source.promoEvents;
    if (eventsToClone.length === 0) {
      const period = ((source.objectiveJson as Record<string, unknown>)?.period as string) ?? DEFAULT_PERIOD;
      const { start, end } = periodToDateRange(period);
      const baselineEvents = await getPromoEventsInRange(start, end);
      eventsToClone = baselineEvents as typeof source.promoEvents;
    }

    const newScenario = await prisma.scenario.create({
      data: {
        name,
        status: "AGENT_GENERATED",
        objectiveJson: source.objectiveJson ?? { objectiveType: "maximize_margin" },
        kpiSummary: {
          revenue: (source.kpiSummary as Record<string, unknown>)?.revenue ?? 0,
          margin: ((source.kpiSummary as Record<string, unknown>)?.margin as number ?? 0) * 1.08,
          roi: ((source.kpiSummary as Record<string, unknown>)?.roi as number ?? 1.2) * 1.02,
          risk: (source.kpiSummary as Record<string, unknown>)?.risk ?? 0.12,
          explanation: "Cloned baseline; increased discount depth on top SKUs; shifted W6–W7 for share defense.",
        },
      },
    });

    for (const e of eventsToClone) {
      await prisma.promoEvent.create({
        data: {
          retailerId: e.retailerId,
          skuId: e.skuId,
          scenarioId: newScenario.id,
          periodStart: e.periodStart,
          periodEnd: e.periodEnd,
          discountDepth: Math.min(0.35, e.discountDepth * 1.1),
          durationWeeks: e.durationWeeks,
          baselineUnits: e.baselineUnits,
          promoUnits: Math.round(e.promoUnits * 1.05),
          inventoryFlag: e.inventoryFlag,
          promoType: e.promoType,
          displaySupport: e.displaySupport ?? false,
          featureAd: e.featureAd ?? false,
        },
      });
    }

    return NextResponse.json({
      scenario: {
        id: newScenario.id,
        name: newScenario.name,
        status: newScenario.status,
        kpiSummary: newScenario.kpiSummary,
      },
    });
  } catch (e) {
    console.error("POST /api/scenarios/workspace/generate-agent", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generate failed" },
      { status: 500 }
    );
  }
}
