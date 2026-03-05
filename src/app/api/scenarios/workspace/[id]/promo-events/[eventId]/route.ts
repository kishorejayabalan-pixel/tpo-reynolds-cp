import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH: Update a promo event (mechanic, discount).
 * Body: { mechanic?: string; discountPct?: number }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  try {
    const { id: _scenarioId, eventId } = await params;
    const body = (await req.json()) as { mechanic?: string; discountPct?: number };
    const event = await prisma.promoEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      return NextResponse.json({ error: "Promo event not found" }, { status: 404 });
    }

    const updates: { promoType?: string; discountDepth?: number; displaySupport?: boolean; featureAd?: boolean } = {};
    if (body.mechanic != null) {
      updates.promoType = body.mechanic;
      updates.displaySupport = body.mechanic === "Display" || body.mechanic === "Feature";
      updates.featureAd = body.mechanic === "Feature";
    }
    if (body.discountPct != null) {
      updates.discountDepth = Math.min(0.5, Math.max(0, body.discountPct / 100));
    }

    await prisma.promoEvent.update({
      where: { id: eventId },
      data: updates,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH promo-events/[eventId]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update promotion" },
      { status: 500 }
    );
  }
}
