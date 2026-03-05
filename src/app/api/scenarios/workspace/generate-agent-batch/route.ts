import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPromoEventsInRange, periodToDateRange } from "@/lib/repo/tpoRepo";

const DEFAULT_PERIOD = "2026-Q2";

const OBJECTIVE_PRESETS: Record<string, { explanation: string; marginMult: number; roiMult: number; riskDelta: number }> = {
  "Max Margin": { explanation: "Maximized margin; deeper discounts on high-margin SKUs.", marginMult: 1.12, roiMult: 1.02, riskDelta: 0.02 },
  "Share Defense": { explanation: "Defended share at key retailers; shifted spend to W6–W7.", marginMult: 1.05, roiMult: 1.0, riskDelta: 0.01 },
  "Inventory Safe": { explanation: "Reduced stockout risk; smoothed promotions across weeks.", marginMult: 1.0, roiMult: 1.05, riskDelta: -0.03 },
  "Balanced Growth": { explanation: "Balanced revenue, margin, and ROI; moderate shifts.", marginMult: 1.06, roiMult: 1.03, riskDelta: 0.0 },
  "Cost Efficiency": { explanation: "Optimized spend efficiency; reallocated from low-ROI events.", marginMult: 1.03, roiMult: 1.08, riskDelta: -0.01 },
};

/**
 * POST: Generate N agent scenarios from a source, with a chosen objective.
 * Body: { sourceScenarioId: string; objective: string; count?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { sourceScenarioId?: string; objective?: string; count?: number };
    const sourceScenarioId = body.sourceScenarioId;
    const objective = (body.objective ?? "Max Margin").trim();
    const count = Math.min(5, Math.max(1, body.count ?? 5));

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

    let eventsToClone = source.promoEvents;
    if (eventsToClone.length === 0) {
      const period = ((source.objectiveJson as Record<string, unknown>)?.period as string) ?? DEFAULT_PERIOD;
      const { start, end } = periodToDateRange(period);
      const baselineEvents = await getPromoEventsInRange(start, end);
      eventsToClone = baselineEvents as typeof source.promoEvents;
    }

    const preset = OBJECTIVE_PRESETS[objective] ?? OBJECTIVE_PRESETS["Balanced Growth"];
    const baseKpi = source.kpiSummary as Record<string, unknown> | null;
    const baseRevenue = (baseKpi?.revenue as number) ?? 9_500_000;
    const baseMargin = (baseKpi?.margin as number) ?? 2_800_000;
    const baseRoi = (baseKpi?.roi as number) ?? 1.33;
    const baseRisk = (baseKpi?.risk as number) ?? 0.12;

    const created: Array<{ id: string; name: string }> = [];

    for (let i = 0; i < count; i++) {
      const variant = i + 1;
      const name = count > 1 ? `Agent Plan – ${objective} ${variant}` : `Agent Plan – ${objective}`;
      const marginMult = preset.marginMult + (i * 0.01);
      const roiMult = preset.roiMult + (i * 0.005);
      const riskDelta = preset.riskDelta + (i * 0.005);

      const newScenario = await prisma.scenario.create({
        data: {
          name,
          status: "AGENT_GENERATED",
          objectiveJson: { objective, objectiveType: objective.replace(/\s+/g, "_").toLowerCase() },
          kpiSummary: {
            revenue: baseRevenue * (0.98 + (i * 0.01)),
            margin: baseMargin * marginMult,
            roi: baseRoi * roiMult,
            risk: Math.max(0.05, Math.min(0.25, baseRisk + riskDelta)),
            explanation: preset.explanation,
          },
        },
      });

      const discountMultiplier = 1.05 + (i * 0.02);
      for (const e of eventsToClone) {
        await prisma.promoEvent.create({
          data: {
            retailerId: e.retailerId,
            skuId: e.skuId,
            scenarioId: newScenario.id,
            periodStart: e.periodStart,
            periodEnd: e.periodEnd,
            discountDepth: Math.min(0.35, e.discountDepth * discountMultiplier),
            durationWeeks: e.durationWeeks,
            baselineUnits: e.baselineUnits,
            promoUnits: Math.round(e.promoUnits * (1.02 + i * 0.01)),
            inventoryFlag: e.inventoryFlag,
            promoType: e.promoType,
            displaySupport: e.displaySupport ?? false,
            featureAd: e.featureAd ?? false,
          },
        });
      }

      created.push({ id: newScenario.id, name: newScenario.name });
    }

    return NextResponse.json({
      scenarios: created,
      objective,
      count: created.length,
    });
  } catch (e) {
    console.error("POST /api/scenarios/workspace/generate-agent-batch", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Batch generate failed" },
      { status: 500 }
    );
  }
}
