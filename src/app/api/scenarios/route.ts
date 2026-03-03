/**
 * Get latest scenario for objective
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const objectiveId = searchParams.get("objectiveId");
  if (!objectiveId) {
    return NextResponse.json(
      { error: "objectiveId required" },
      { status: 400 }
    );
  }
  const scenario = await prisma.scenario.findFirst({
    where: { objectiveId },
    orderBy: { createdAt: "desc" },
  });
  if (!scenario) {
    return NextResponse.json({ scenario: null });
  }
  return NextResponse.json({
    scenario: {
      ...scenario,
      planJson: scenario.planJson as object,
      kpisJson: scenario.kpisJson as object,
    },
  });
}
