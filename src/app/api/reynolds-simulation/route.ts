/**
 * Run Reynolds TPO simulation: 1000 scenarios, maximize incremental margin
 * Constraints: trade spend 4–6%, max discount 20%, min Walmart 30%
 */
import { NextRequest, NextResponse } from "next/server";
import { runReynoldsSimulation } from "@/lib/tpo/reynoldsSimulation";
import {
  getPromoEventsInRange,
  periodToDateRange,
  toReynoldsEventInput,
} from "@/lib/repo/tpoRepo";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      period?: string;
      nSims?: number;
      seed?: number;
    };
    const period = body.period ?? "2026-Q2";
    const nSims = body.nSims ?? 1000;
    const seed = body.seed ?? 42;

    const { start, end } = periodToDateRange(period);
    const events = await getPromoEventsInRange(start, end);
    const reynoldsEvents = toReynoldsEventInput(events);

    if (reynoldsEvents.length === 0) {
      return NextResponse.json(
        { error: "No promo events found for period. Run seed:reynolds first." },
        { status: 400 }
      );
    }

    const result = runReynoldsSimulation({
      events: reynoldsEvents,
      nSims,
      seed,
      constraints: {
        minTradeSpendPct: 0.04,
        maxTradeSpendPct: 0.06,
        maxDiscountPct: 0.2,
        minWalmartRevenuePct: 0.3,
      },
    });

    return NextResponse.json({
      ok: true,
      topScenario: {
        totalIncrementalMargin: result.topScenario.totalIncrementalMargin,
        totalTradeSpend: result.topScenario.totalTradeSpend,
        totalRevenue: result.topScenario.totalRevenue,
        tradeSpendPct: (result.topScenario.tradeSpendPct * 100).toFixed(2) + "%",
        roi: result.topScenario.roi.toFixed(2) + "x",
        compliant: result.topScenario.compliant,
        walmartRevenuePct: (result.topScenario.walmartRevenuePct * 100).toFixed(1) + "%",
      },
      top5Scenarios: result.top5Scenarios.map((s) => ({
        totalIncrementalMargin: s.totalIncrementalMargin,
        roi: s.roi,
        compliant: s.compliant,
      })),
      allScenariosCount: result.allScenariosCount,
      compliantCount: result.compliantCount,
      runtimeMs: result.runtimeMs,
      seed: result.seed,
    });
  } catch (e) {
    console.error("Reynolds simulation error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Simulation failed" },
      { status: 500 }
    );
  }
}
