import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "20", 10) || 20,
      100
    );
    const retailerId = searchParams.get("retailerId") ?? undefined;

    if (!prisma?.decisionLog) {
      console.error("GET /api/decision-log: prisma.decisionLog is undefined (schema/client mismatch)");
      return NextResponse.json(
        {
          error: "Decision log not available",
          detail: "Database model DecisionLog is missing. Run: npx prisma generate && npx prisma migrate dev",
        },
        { status: 500 }
      );
    }

    const entries = await prisma.decisionLog.findMany({
      where: retailerId ? { retailerId } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      entries: entries.map((e) => ({
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        retailerId: e.retailerId,
        agent: e.agent,
        action: e.action,
        reason: e.reason,
        beforeKpi: e.beforeKpiJson
          ? (JSON.parse(e.beforeKpiJson) as Record<string, unknown>)
          : null,
        afterKpi: e.afterKpiJson
          ? (JSON.parse(e.afterKpiJson) as Record<string, unknown>)
          : null,
        diff: e.diff
          ? (JSON.parse(e.diff) as Record<string, unknown>)
          : null,
        signalContext: e.signalContext
          ? (JSON.parse(e.signalContext) as Record<string, unknown>)
          : null,
      })),
    });
  } catch (e) {
    console.error("GET /api/decision-log", e);
    return NextResponse.json(
      { error: "Failed to load decision log", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
