/**
 * Agentic TPO optimize API
 * POST { objectiveId } -> { scenarioId }
 */
import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/tpo/agenticEngine";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      objectiveId?: string;
    };
    const objectiveId = body.objectiveId;
    if (!objectiveId) {
      return NextResponse.json(
        { error: "objectiveId is required" },
        { status: 400 }
      );
    }
    const scenarioId = await runAgent(objectiveId);
    return NextResponse.json({ scenarioId });
  } catch (e) {
    console.error("Optimize error:", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Optimization failed",
      },
      { status: 500 }
    );
  }
}
