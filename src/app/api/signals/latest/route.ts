import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/signals/latest?limit=12 - latest SignalTicks for Live Alerts */
export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "12", 10) || 12, 50);
    const ticks = await prisma.signalTick.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const retailers = await prisma.retailer.findMany({ select: { id: true, name: true } });
    const byId = new Map(retailers.map((r) => [r.id, r.name]));

    const signals = ticks.map((t) => {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(t.payload) as Record<string, unknown>;
      } catch {}
      const category = (t.category ?? (payload.category as string) ?? "—") as string;
      const skuCode = (payload.skuCode as string) ?? "—";
      const weeks = (payload.weeks as number[]) ?? [];
      const retailerName = t.retailerId ? byId.get(t.retailerId) ?? t.retailerId : "—";
      const severity =
        t.type === "competitor_drop"
          ? Math.min(100, Math.round(Math.abs((payload.competitorIndexDeltaPct as number) ?? 0) * 400))
          : t.type === "inventory_delay"
            ? Math.min(100, 40 + ((payload.delayWeeks as number) ?? 0) * 20)
            : t.type === "demand_spike"
              ? Math.min(100, 30 + ((payload.deltaPct as number) ?? 0) * 200)
              : 50;
      return {
        id: t.id,
        timestamp: t.createdAt.toISOString(),
        type: t.type,
        retailerId: t.retailerId,
        retailerName,
        category,
        skuCode,
        weeks,
        payload,
        severity: Math.min(100, Math.max(0, severity)),
      };
    });

    return NextResponse.json({ signals });
  } catch (e) {
    console.error("GET /api/signals/latest", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load signals" },
      { status: 500 }
    );
  }
}
