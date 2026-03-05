import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET: list all workspace scenarios */
export async function GET() {
  try {
    if (!prisma.scenario) {
      return NextResponse.json(
        { error: "Scenario model not available" },
        { status: 500 }
      );
    }
    const scenarios = await prisma.scenario.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        kpiSummary: true,
        objectiveJson: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { promoEvents: true } },
      },
    });
    return NextResponse.json({
      scenarios: scenarios.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        kpiSummary: s.kpiSummary as Record<string, unknown> | null,
        objectiveJson: s.objectiveJson as Record<string, unknown> | null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        promoEventCount: s._count.promoEvents,
      })),
    });
  } catch (e) {
    console.error("GET /api/scenarios/workspace", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list scenarios" },
      { status: 500 }
    );
  }
}

/** POST: create a new workspace scenario */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name?: string;
      status?: string;
      objectiveJson?: Record<string, unknown>;
      kpiSummary?: Record<string, unknown>;
    };
    const name = body.name ?? `Scenario ${Date.now()}`;
    const status = body.status ?? "DRAFT";
    if (!prisma.scenario) {
      return NextResponse.json(
        { error: "Scenario model not available" },
        { status: 500 }
      );
    }
    const scenario = await prisma.scenario.create({
      data: {
        name,
        status,
        objectiveJson: body.objectiveJson ?? undefined,
        kpiSummary: body.kpiSummary ?? undefined,
      },
    });
    return NextResponse.json({
      scenario: {
        id: scenario.id,
        name: scenario.name,
        status: scenario.status,
        kpiSummary: scenario.kpiSummary as Record<string, unknown> | null,
        objectiveJson: scenario.objectiveJson as Record<string, unknown> | null,
        createdAt: scenario.createdAt.toISOString(),
        updatedAt: scenario.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("POST /api/scenarios/workspace", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create scenario" },
      { status: 500 }
    );
  }
}
