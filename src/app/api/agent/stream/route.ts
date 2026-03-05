import { NextRequest } from "next/server";
import {
  getBudgets,
  getRetailers,
  getPromoEventsInRange,
  buildResponseCurve,
  periodToDateRange,
} from "@/lib/repo/tpoRepo";
import { runAgenticOptimization, type Objective, type AgenticConstraints } from "@/lib/tpo/agenticEngine";

type StreamEvent =
  | { type: "step"; step: string; message?: string }
  | { type: "tool_start"; name: string; args?: Record<string, unknown> }
  | { type: "tool_end"; name: string; durationMs?: number }
  | { type: "progress"; i: number; total: number; best?: unknown; top5Preview?: unknown[] }
  | { type: "done"; result?: unknown }
  | { type: "error"; message: string };

function sseLine(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const period = searchParams.get("period") ?? "2026-Q2";
  const objective = (searchParams.get("objective") as Objective) ?? "maximize_margin";
  const sims = Math.min(Math.max(parseInt(searchParams.get("sims") ?? "1000", 10) || 1000, 100), 5000);

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: StreamEvent) => {
        controller.enqueue(new TextEncoder().encode(sseLine(event)));
      };

      try {
        enqueue({ type: "step", step: "start", message: `Running agentic optimization (${sims} sims)` });

        enqueue({ type: "tool_start", name: "runAgenticOptimization", args: { period, objective, sims } });
        const toolStart = performance.now();

        const { start, end } = periodToDateRange(period);
        const [budgets, retailers, promoEvents] = await Promise.all([
          getBudgets(period),
          getRetailers(),
          getPromoEventsInRange(start, end),
        ]);

        let baseAllocation = budgets.map((b) => ({
          retailerId: b.retailerId,
          retailerName: b.retailer.name,
          spend: b.spend,
        }));
        if (baseAllocation.length === 0 && retailers.length > 0) {
          const defaultSpend = 1_000_000;
          baseAllocation = retailers.map((r) => ({
            retailerId: r.id,
            retailerName: r.name,
            spend: defaultSpend / retailers.length,
          }));
        }

        const inventoryFlags: Record<string, "OK" | "LOW"> = {};
        for (const e of promoEvents) {
          const existing = inventoryFlags[e.retailerId];
          if (!existing || e.inventoryFlag === "LOW") {
            inventoryFlags[e.retailerId] = e.inventoryFlag as "OK" | "LOW";
          }
        }

        const responseCurve = buildResponseCurve(promoEvents, budgets);
        const constraints: AgenticConstraints = {};

        enqueue({ type: "step", step: "simulate", message: `Running ${sims} simulations...` });

        const result = runAgenticOptimization({
          periodStart: start,
          periodEnd: end,
          objective,
          constraints,
          baseAllocation,
          responseCurve,
          retailerCoverage: retailers.map((r) => ({ name: r.name, circanaCoverage: r.circanaCoverage })),
          inventoryFlags,
          nSims: sims,
          seed: 42,
          onProgress({ i, best, top5Preview }) {
            enqueue({
              type: "progress",
              i,
              total: sims,
              best: best ? { roi: best.roi, incMargin: best.incMargin, revenue: best.revenue } : undefined,
              top5Preview: top5Preview?.slice(0, 5).map((s) => ({
                roi: s.roi,
                incMargin: s.incMargin,
                revenue: s.revenue,
              })),
            });
          },
        });

        const durationMs = Math.round(performance.now() - toolStart);
        enqueue({ type: "tool_end", name: "runAgenticOptimization", durationMs });
        enqueue({
          type: "done",
          result: {
            topScenario: result.topScenario,
            top5Scenarios: result.top5Scenarios,
            allScenariosCount: result.allScenariosCount,
            runtimeMs: result.runtimeMs,
          },
        });
      } catch (e) {
        enqueue({
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Connection: "keep-alive",
    },
  });
}
