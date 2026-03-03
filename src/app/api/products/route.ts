/**
 * List products for Planner
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ products });
  } catch (e) {
    console.error("Products API error:", e);
    return NextResponse.json({ products: [], error: "Failed to load products" }, { status: 500 });
  }
}
