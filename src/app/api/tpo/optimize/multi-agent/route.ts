/**
 * Multi-agent TPO optimization
 */
import { NextRequest, NextResponse } from "next/server";
import { runMultiAgentOptimization } from "@/lib/tpo/multiAgent/orchestrator";

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
    const scenarioId = await runMultiAgentOptimization(
      objectiveId,
      body.nCandidates ?? 1000,
      body.seed ?? 42
    );
    return NextResponse.json({ scenarioId });
  } catch (e) {
    console.error("Multi-agent optimize error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Optimization failed" },
      { status: 500 }
    );
  }
}
