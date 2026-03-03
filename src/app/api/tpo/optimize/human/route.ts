/**
 * Human (Copilot) optimization — optimize from user's DRAFT plan
 */
import { NextRequest, NextResponse } from "next/server";
import { runHumanOptimization } from "@/lib/tpo/multiAgent/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      objectiveId?: string;
      nCandidates?: number;
      seed?: number;
    };
    const objectiveId = body.objectiveId;
    if (!objectiveId) {
      return NextResponse.json(
        { error: "objectiveId is required" },
        { status: 400 }
      );
    }
    const scenarioId = await runHumanOptimization(
      objectiveId,
      body.nCandidates ?? 1000,
      body.seed ?? 42
    );
    return NextResponse.json({ scenarioId });
  } catch (e) {
    console.error("Human optimize error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Optimization failed" },
      { status: 500 }
    );
  }
}
