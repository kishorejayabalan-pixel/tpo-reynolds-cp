/**
 * Replace all DRAFT promotions for period+retailer with new plan
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      period: string;
      retailerName?: string;
      retailerId?: string;
      promotions: Array<{
        productId: string;
        promoType: string;
        discountPct?: number;
        displayFlag?: boolean;
        featureFlag?: boolean;
        startWeek: number;
        durationWeeks: number;
      }>;
    };
    const { period, promotions } = body;
    let retailerId = body.retailerId;
    if (!retailerId && body.retailerName) {
      const r = await prisma.retailer.findFirst({
        where: { name: body.retailerName },
      });
      if (!r) throw new Error(`Retailer "${body.retailerName}" not found`);
      retailerId = r.id;
    }
    if (!retailerId) {
      return NextResponse.json(
        { error: "retailerId or retailerName required" },
        { status: 400 }
      );
    }

    await prisma.promotion.updateMany({
      where: { period, retailerId, status: "DRAFT" },
      data: { status: "ARCHIVED" },
    });

    const created = [];
    for (const p of promotions) {
      const promo = await prisma.promotion.create({
        data: {
          period,
          retailerId,
          productId: p.productId,
          promoType: p.promoType ?? "ALL_PRICE_OFF",
          discountPct: p.discountPct ?? 0.1,
          displayFlag: p.displayFlag ?? false,
          featureFlag: p.featureFlag ?? false,
          startWeek: p.startWeek,
          durationWeeks: p.durationWeeks,
          status: "DRAFT",
        },
        include: { product: true },
      });
      created.push(promo);
    }

    return NextResponse.json({ ok: true, count: created.length });
  } catch (e) {
    console.error("Replace promotions error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Replace failed" },
      { status: 500 }
    );
  }
}
