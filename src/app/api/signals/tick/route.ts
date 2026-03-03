import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SIGNAL_TYPES = ["competitor_drop", "inventory_delay", "demand_spike"] as const;

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      type?: string;
      retailerId?: string;
      category?: string;
    };

    let type = body.type ?? randomPick(SIGNAL_TYPES);
    if (!SIGNAL_TYPES.includes(type as (typeof SIGNAL_TYPES)[number])) {
      type = randomPick(SIGNAL_TYPES);
    }

    const retailers = await prisma.retailer.findMany({ select: { id: true } });
    const retailerId = body.retailerId ?? (retailers.length ? retailers[Math.floor(Math.random() * retailers.length)]!.id : null);
    const categories = ["Foil", "Trash Bags", "Food Storage"];
    const category = body.category ?? randomPick(categories);

    let payload: Record<string, unknown>;

    switch (type) {
      case "competitor_drop":
        payload = {
          competitorIndexDeltaPct: -(5 + Math.random() * 8),
          category,
          message: `Competitor price index down in ${category}`,
        };
        break;
      case "inventory_delay":
        payload = {
          delayWeeks: 1 + Math.floor(Math.random() * 3),
          skuId: null,
          message: "Inbound shipment delayed",
        };
        break;
      case "demand_spike":
        payload = {
          demandLiftPct: 10 + Math.random() * 25,
          category,
          message: `Demand spike in ${category}`,
        };
        break;
      default:
        payload = { message: "Signal event" };
    }

    const tick = await prisma.signalTick.create({
      data: {
        type,
        retailerId,
        category: type !== "inventory_delay" ? category : null,
        payload: JSON.stringify(payload),
      },
    });

    return NextResponse.json({
      signal: {
        id: tick.id,
        type: tick.type,
        retailerId: tick.retailerId,
        category: tick.category,
        payload: JSON.parse(tick.payload) as Record<string, unknown>,
        createdAt: tick.createdAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("POST /api/signals/tick", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create signal tick" },
      { status: 500 }
    );
  }
}
