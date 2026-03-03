import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const retailerId = searchParams.get("retailerId");

    const where = retailerId ? { retailerId } : {};
    const budgets = await prisma.budget.findMany({
      where,
      include: { retailer: { select: { id: true, name: true } } },
      orderBy: [{ period: "asc" }, { retailerId: "asc" }],
    });

    return NextResponse.json({
      budgets: budgets.map((b) => ({
        id: b.id,
        retailerId: b.retailerId,
        retailerName: b.retailer.name,
        period: b.period,
        spend: b.spend,
      })),
    });
  } catch (e) {
    console.error("GET /api/budgets", e);
    return NextResponse.json(
      { error: "Failed to load budgets" },
      { status: 500 }
    );
  }
}
