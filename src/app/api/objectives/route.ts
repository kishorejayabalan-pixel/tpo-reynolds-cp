/**
 * Get or create Objective by period + retailer
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "2026-Q2";
  const retailerName = searchParams.get("retailer");
  const retailerId = searchParams.get("retailerId");

  if (!retailerName && !retailerId) {
    return NextResponse.json(
      { error: "retailer or retailerId required" },
      { status: 400 }
    );
  }

  let rid = retailerId;
  if (!rid && retailerName) {
    const r = await prisma.retailer.findFirst({
      where: { name: retailerName },
    });
    if (!r) {
      return NextResponse.json(
        { error: `Retailer "${retailerName}" not found` },
        { status: 404 }
      );
    }
    rid = r.id;
  }

  let obj = await prisma.objective.findFirst({
    where: { period, retailerId: rid },
    include: { retailer: true },
  });
  if (!obj) {
    obj = await prisma.objective.create({
      data: {
        period,
        retailerId: rid!,
        objectiveType: "MAX_MARGIN",
        maxDiscountPct: 0.2,
        tradeSpendPctMin: 0.04,
        tradeSpendPctMax: 0.06,
      },
      include: { retailer: true },
    });
  }
  return NextResponse.json({ objective: obj });
}
