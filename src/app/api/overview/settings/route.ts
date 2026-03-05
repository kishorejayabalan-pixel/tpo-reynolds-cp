import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/overview/settings?retailerId= - approval mode + runbook for Overview */
export async function GET(req: NextRequest) {
  try {
    const retailerId = req.nextUrl.searchParams.get("retailerId") ?? undefined;
    if (!retailerId) {
      return NextResponse.json({
        approvalMode: "SuggestOnly",
        runbook: {
          guardrails: { roiFloor: 1.2, spendCap: 3_000_000, maxChangePerCycle: 0.1, stockoutMax: 0.15 },
          triggers: ["competitor_drop_5", "inventory_delay", "demand_spike"],
          frequencySeconds: 60,
        },
      });
    }
    const state = await prisma.autopilotState.findUnique({
      where: { retailerId },
    });
    let runbook = {
      guardrails: { roiFloor: 1.2, spendCap: 3_000_000, maxChangePerCycle: 0.1, stockoutMax: 0.15 },
      triggers: ["competitor_drop_5", "inventory_delay", "demand_spike"],
      frequencySeconds: 60,
    };
    if (state?.runbookJson) {
      try {
        runbook = { ...runbook, ...JSON.parse(state.runbookJson) };
      } catch {}
    }
    return NextResponse.json({
      approvalMode: state?.approvalMode ?? "SuggestOnly",
      runbook,
    });
  } catch (e) {
    console.error("GET /api/overview/settings", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load settings" },
      { status: 500 }
    );
  }
}

/** PATCH /api/overview/settings - update approval mode and/or runbook */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      retailerId?: string;
      approvalMode?: string;
      runbook?: Record<string, unknown>;
    };
    const retailerId = body.retailerId ?? req.nextUrl.searchParams.get("retailerId");
    if (!retailerId) {
      return NextResponse.json({ error: "retailerId required" }, { status: 400 });
    }
    const state = await prisma.autopilotState.upsert({
      where: { retailerId },
      update: {
        ...(body.approvalMode != null && { approvalMode: body.approvalMode }),
        ...(body.runbook != null && { runbookJson: JSON.stringify(body.runbook) }),
        updatedAt: new Date(),
      },
      create: {
        retailerId,
        approvalMode: body.approvalMode ?? "SuggestOnly",
        runbookJson: body.runbook ? JSON.stringify(body.runbook) : null,
      },
    });
    let runbook: Record<string, unknown> = {};
    if (state.runbookJson) {
      try {
        runbook = JSON.parse(state.runbookJson) as Record<string, unknown>;
      } catch {}
    }
    return NextResponse.json({
      approvalMode: state.approvalMode ?? "SuggestOnly",
      runbook,
    });
  } catch (e) {
    console.error("PATCH /api/overview/settings", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}
