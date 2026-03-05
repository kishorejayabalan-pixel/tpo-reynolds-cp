import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSkuDisplayName } from "@/lib/skuDisplayNames";

export async function GET() {
  try {
    const skus = await prisma.sKU.findMany({
      orderBy: { skuCode: "asc" },
      select: { id: true, skuCode: true, category: true, brand: true, name: true, segment: true },
    });
    const skusWithDisplayName = skus.map((s) => ({
      ...s,
      displayName: getSkuDisplayName(s.skuCode, s.brand, s.name),
    }));
    return NextResponse.json({ skus: skusWithDisplayName });
  } catch (e) {
    console.error("GET /api/skus", e);
    return NextResponse.json(
      { error: "Failed to load SKUs" },
      { status: 500 }
    );
  }
}
