/**
 * Agent (Autopilot) optimization — UserProxyAgent draft + multi-round search
 */
import { NextRequest, NextResponse } from "next/server";
import { runAgentOptimization } from "@/lib/tpo/multiAgent/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      objectiveId?: string;
      targetJson?: {
        targetRevenue?: number;
        targetMargin?: number;
        maxDiscountPct?: number;
        spendPctMin?: number;
        spendPctMax?: number;
      };
      nCandidates?: number;
      maxRounds?: number;
      seed?: number;
    };
    const objectiveId = body.objectiveId;
    if (!objectiveId) {
      return NextResponse.json(
        { error: "objectiveId is required" },
        { status: 400 }
      );
    }
    const targetJson = body.targetJson ?? {};
    const scenarioId = await runAgentOptimization(
      objectiveId,
      targetJson,
      body.nCandidates ?? 1000,
      body.maxRounds ?? 5,
      body.seed ?? 42
    );
    return NextResponse.json({ scenarioId });
  } catch (e) {
    console.error("Autopilot optimize error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Optimization failed" },
      { status: 500 }
    );
  }
}
