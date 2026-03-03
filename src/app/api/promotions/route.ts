/**
 * Planner: list promotions (calendar) and add promo
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "2026-Q2";
  const retailerName = searchParams.get("retailer");
  if (!retailerName) {
    return NextResponse.json(
      { error: "retailer required" },
      { status: 400 }
    );
  }
  const r = await prisma.retailer.findFirst({
    where: { name: retailerName },
  });
  if (!r) {
    return NextResponse.json(
      { error: `Retailer "${retailerName}" not found` },
      { status: 404 }
    );
  }
  const promotions = await prisma.promotion.findMany({
    where: { period, retailerId: r.id },
    include: { product: true },
  });
  return NextResponse.json({ promotions });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      period: string;
      retailerId?: string;
      retailerName?: string;
      productId: string;
      promoType: string;
      discountPct: number;
      displayFlag: boolean;
      featureFlag: boolean;
      startWeek: number;
      durationWeeks: number;
    };
    const { period, productId, promoType, discountPct, displayFlag, featureFlag, startWeek, durationWeeks } = body;
    let retailerId = body.retailerId;
    if (!retailerId && body.retailerName) {
      const r = await prisma.retailer.findFirst({
        where: { name: body.retailerName },
      });
      if (!r) throw new Error(`Retailer "${body.retailerName}" not found`);
      retailerId = r.id;
    }
    if (!retailerId || !productId) {
      return NextResponse.json(
        { error: "retailerId/retailerName and productId required" },
        { status: 400 }
      );
    }
    const promo = await prisma.promotion.create({
      data: {
        period: period ?? "2026-Q2",
        retailerId,
        productId,
        promoType: promoType ?? "ALL_PRICE_OFF",
        discountPct: discountPct ?? 0.1,
        displayFlag: displayFlag ?? false,
        featureFlag: featureFlag ?? false,
        startWeek: startWeek ?? 0,
        durationWeeks: durationWeeks ?? 2,
        status: "DRAFT",
      },
      include: { product: true },
    });
    return NextResponse.json({ promotion: promo });
  } catch (e) {
    console.error("Add promo error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Add promo failed" },
      { status: 500 }
    );
  }
}
