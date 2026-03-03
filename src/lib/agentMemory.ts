/**
 * Agent learning + memory: getAgentContext, updateAgentMemory
 * Memory survives refresh/restart (SQLite).
 */

import { prisma } from "./db";

export interface ExtractedPreferences {
  preferredObjective?: "maximize_margin" | "maximize_revenue" | "balanced";
  retailerPriorities?: string[];
  riskTolerance?: "low" | "medium" | "high";
  typicalPeriod?: string;
  minSpendByRetailer?: Record<string, number>;
  excludeRetailers?: string[];
  notes?: string | null;
}

export interface AgentContext {
  conversationId: string;
  summary: string;
  memory: {
    preferredObjective: string;
    retailerPriorities: string[];
    riskTolerance: string;
    typicalPeriod: string;
    minSpendByRetailer: Record<string, number>;
    excludeRetailers: string[];
    notes: string | null;
  };
}

const MAX_SUMMARY_CHARS = 800;

export async function getAgentContext(conversationId: string): Promise<AgentContext | null> {
  try {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { agentMemory: true },
  });
  if (!conv) return null;

  const mem = conv.agentMemory;
  const retailerPriorities: string[] = mem?.retailerPriorities
    ? (JSON.parse(mem.retailerPriorities) as string[])
    : [];
  const constraints = mem?.constraintsJson
    ? (JSON.parse(mem.constraintsJson) as { minSpendByRetailer?: Record<string, number>; excludeRetailers?: string[] })
    : {};

  return {
    conversationId: conv.id,
    summary: conv.summary,
    memory: {
      preferredObjective: mem?.preferredObjective ?? "maximize_margin",
      retailerPriorities,
      riskTolerance: mem?.riskTolerance ?? "medium",
      typicalPeriod: mem?.typicalPeriod ?? "2026-Q2",
      minSpendByRetailer: constraints.minSpendByRetailer ?? {},
      excludeRetailers: constraints.excludeRetailers ?? [],
      notes: mem?.notes ?? null,
    },
  };
  } catch {
    return null;
  }
}

export async function updateAgentMemory(
  conversationId: string,
  extracted: ExtractedPreferences
): Promise<void> {
  try {
    const existing = await prisma.agentMemory.findUnique({
      where: { conversationId },
    });

    const data: {
      preferredObjective?: string;
      retailerPriorities?: string;
      riskTolerance?: string;
      typicalPeriod?: string;
      constraintsJson?: string;
      notes?: string;
    } = {};

    if (extracted.preferredObjective) data.preferredObjective = extracted.preferredObjective;
    if (extracted.retailerPriorities?.length)
      data.retailerPriorities = JSON.stringify(extracted.retailerPriorities);
    if (extracted.riskTolerance) data.riskTolerance = extracted.riskTolerance;
    if (extracted.typicalPeriod) data.typicalPeriod = extracted.typicalPeriod;
    if (
      extracted.minSpendByRetailer ||
      (extracted.excludeRetailers && extracted.excludeRetailers.length > 0)
    ) {
      data.constraintsJson = JSON.stringify({
        minSpendByRetailer: extracted.minSpendByRetailer ?? {},
        excludeRetailers: extracted.excludeRetailers ?? [],
      });
    }
    if (extracted.notes) data.notes = extracted.notes;

    if (existing) {
      await prisma.agentMemory.update({
        where: { conversationId },
        data,
      });
    } else {
      await prisma.agentMemory.create({
        data: { conversationId, ...data },
      });
    }
  } catch {
    // agentMemory model may not exist (e.g. packages/db schema)
  }
}

export async function updateConversationSummary(
  conversationId: string,
  newSummary: string
): Promise<void> {
  const truncated = newSummary.length > MAX_SUMMARY_CHARS
    ? newSummary.slice(0, MAX_SUMMARY_CHARS - 3) + "..."
    : newSummary;
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { summary: truncated },
  });
}
