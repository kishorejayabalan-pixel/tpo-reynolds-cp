import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const retailers = await prisma.retailer.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json({
      retailers: retailers.map((r) => ({
        id: r.id,
        name: r.name,
        channel: r.channel,
        circanaCoverage: r.circanaCoverage,
        priority: r.priority,
      })),
    });
  } catch (e) {
    console.error("GET /api/retailers", e);
    return NextResponse.json(
      { error: "Failed to load retailers" },
      { status: 500 }
    );
  }
}
