/**
 * Store and retrieve the latest optimization run for the Summary Report.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  const run = await prisma.optimizationRun.findFirst({
    where: conversationId ? { conversationId } : undefined,
    orderBy: { createdAt: "desc" },
  });
  if (!run) {
    return NextResponse.json({ run: null });
  }
  const payload = JSON.parse(run.payload) as Record<string, unknown>;
  return NextResponse.json({ run: { ...run, payload } });
}
