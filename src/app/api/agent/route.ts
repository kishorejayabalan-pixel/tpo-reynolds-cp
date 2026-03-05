import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getRetailers,
  getBudgets,
  getPromoEventsInRange,
  buildResponseCurve,
  periodToDateRange,
} from "@/lib/repo/tpoRepo";
import { runAgenticOptimization, type Objective, type AgenticConstraints } from "@/lib/tpo/agenticEngine";
import { REYNOLDS_WALMART_DEAL_TYPES } from "@/lib/tpo/dealTypes";
import {
  getAgentContext,
  updateAgentMemory,
  updateConversationSummary,
  type ExtractedPreferences,
} from "@/lib/agentMemory";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder",
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

const AgentPayload = z.object({
  conversationId: z.string().optional(),
  userMessage: z.string(),
  screen: z.enum(["overview", "planner", "optimizer", "reports"]).optional(),
  period: z.string().optional(),
  objective: z.enum(["maximize_margin", "maximize_revenue", "balanced"]).optional(),
  constraints: z
    .object({
      minSpendByRetailer: z.record(z.number()).optional(),
      maxShiftPct: z.number().optional(),
      maxDiscountDepth: z.number().optional(),
      includeRetailers: z.array(z.string()).optional(),
      excludeRetailers: z.array(z.string()).optional(),
    })
    .optional(),
});

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "getCurrentBudgets",
      description: "Get current budget allocation by retailer for a given period",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "e.g. 2026-Q2, 2026-03" },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "runAgenticOptimization",
      description:
        "Run 1000 simulations to optimize trade spend allocation. Returns top scenario, top 5, explanation bullets.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string" },
          objective: {
            type: "string",
            enum: ["maximize_margin", "maximize_revenue", "balanced"],
          },
          constraints: {
            type: "object",
            properties: {
              minSpendByRetailer: { type: "object", additionalProperties: { type: "number" } },
              maxShiftPct: { type: "number" },
              maxDiscountDepth: { type: "number" },
              includeRetailers: { type: "array", items: { type: "string" } },
              excludeRetailers: { type: "array", items: { type: "string" } },
            },
          },
          sims: { type: "number", description: "Number of simulations (default 1000)" },
        },
        required: ["period", "objective"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getCoverageNotes",
      description: "Get Circana coverage gaps (Walmart, Club, Amazon, etc.)",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "saveScenario",
      description: "Save a scenario with a name for later reference",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          scenarioPayload: { type: "object" },
        },
        required: ["name", "scenarioPayload"],
      },
    },
  },
];

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  conversationId: string
): Promise<unknown> {
  if (name === "getCurrentBudgets" || name === "getBudgets") {
    const period = (args.period as string) || "2026-Q2";
    const budgets = await getBudgets(period);
    return budgets.map((b) => ({
      retailerId: b.retailerId,
      retailerName: b.retailer.name,
      spend: b.spend,
      period: b.period,
    }));
  }

  if (name === "getCoverageNotes") {
    const retailers = await getRetailers();
    const gaps = retailers.filter((r) => !r.circanaCoverage);
    return {
      dataGapNote: gaps.length
        ? `Circana has limited/no access to ${gaps.map((r) => r.name).join(", ")}. Confidence is lower where retailer-native feeds are missing.`
        : "Full Circana coverage.",
      gaps: gaps.map((r) => r.name),
    };
  }

  if (name === "saveScenario") {
    try {
      const name = args.name as string;
      const payload = args.scenarioPayload as Record<string, unknown>;
      await prisma.savedScenario.create({
        data: { name, payload: JSON.stringify(payload) },
      });
      return { saved: true, name };
    } catch {
      return { saved: false, error: "Could not save scenario" };
    }
  }

  if (name === "runAgenticOptimization") {
    const period = (args.period as string) || "2026-Q2";
    const objective = (args.objective as Objective) || "maximize_margin";
    const sims = (args.sims as number) ?? 1000;
    const constraints = (args.constraints as Record<string, unknown>) || {};

    const budgets = await getBudgets(period);
    const retailers = await getRetailers();
    const { start, end } = periodToDateRange(period);
    const promoEvents = await getPromoEventsInRange(start, end);

    let baseAllocation = budgets.map((b) => ({
      retailerId: b.retailerId,
      retailerName: b.retailer.name,
      spend: b.spend,
    }));

    if (baseAllocation.length === 0 && retailers.length > 0) {
      const defaultSpend = 1_000_000;
      baseAllocation = retailers.map((r) => ({
        retailerId: r.id,
        retailerName: r.name,
        spend: defaultSpend / retailers.length,
      }));
    }

    const inventoryFlags: Record<string, "OK" | "LOW"> = {};
    for (const e of promoEvents) {
      const existing = inventoryFlags[e.retailerId];
      if (!existing || e.inventoryFlag === "LOW") {
        inventoryFlags[e.retailerId] = e.inventoryFlag as "OK" | "LOW";
      }
    }

    const responseCurve = buildResponseCurve(promoEvents, budgets);

    const agenticConstraints: AgenticConstraints = {};
    if (constraints.minSpendByRetailer)
      agenticConstraints.minSpendByRetailer = constraints.minSpendByRetailer as Record<string, number>;
    if (constraints.maxShiftPct != null) agenticConstraints.maxShiftPct = constraints.maxShiftPct as number;
    if (constraints.maxDiscountDepth != null)
      agenticConstraints.maxDiscountDepth = constraints.maxDiscountDepth as number;
    if (constraints.includeRetailers)
      agenticConstraints.includeRetailers = constraints.includeRetailers as string[];
    if (constraints.excludeRetailers)
      agenticConstraints.excludeRetailers = constraints.excludeRetailers as string[];

    const result = runAgenticOptimization({
      periodStart: start,
      periodEnd: end,
      objective,
      constraints: agenticConstraints,
      baseAllocation,
      responseCurve,
      retailerCoverage: retailers.map((r) => ({ name: r.name, circanaCoverage: r.circanaCoverage })),
      inventoryFlags,
      nSims: sims,
      seed: 42,
    });

    const baseByName = Object.fromEntries(baseAllocation.map((b) => [b.retailerName, b.spend]));
    const deltasVsBase: Record<string, number> = {};
    for (const [n, v] of Object.entries(result.topScenario.allocation)) {
      deltasVsBase[n] = v - (baseByName[n] ?? 0);
    }

    const payloadForReport = {
      ...result,
      period,
      objective,
      baseAllocation,
      recommendedAllocation: result.topScenario.allocation,
      deltasVsBase,
      confidence:
        result.topScenario.confidenceScore > 0.8
          ? "high"
          : result.topScenario.confidenceScore > 0.5
            ? "medium"
            : "low",
      kpis: {
        incMargin: result.topScenario.incMargin,
        revenue: result.topScenario.revenue,
        roi: result.topScenario.roi,
        incUnits: result.topScenario.incUnits,
        riskScore: result.topScenario.riskScore,
        confidenceScore: result.topScenario.confidenceScore,
      },
    };

    if (prisma.decisionLog) {
      try {
        await prisma.decisionLog.create({
          data: {
            retailerId: null,
            agent: "chat_agent",
            action: "runAgenticOptimization",
            reason: (result.explanationBullets ?? []).join("; ") || "Budget optimization run",
            beforeKpiJson: JSON.stringify({ baseAllocation: baseByName }),
            afterKpiJson: JSON.stringify(result.topScenario),
            diff: JSON.stringify(deltasVsBase),
            signalContext: JSON.stringify({ period, objective }),
            constraints: JSON.stringify(constraints),
            kpiBefore: JSON.stringify(baseByName),
            kpiAfter: JSON.stringify(result.topScenario),
            top5: JSON.stringify(result.top5Scenarios.map((s) => ({ allocation: s.allocation, roi: s.roi, incMargin: s.incMargin }))),
            explanation: result.explanationBullets?.join("; ") ?? null,
          },
        });
      } catch (err) {
        console.warn("DecisionLog create failed:", err);
      }
    }

    try {
      await prisma.optimizationRun.create({
        data: {
          conversationId,
          payload: JSON.stringify(payloadForReport),
          scenarioCount: result.allScenariosCount,
          runtimeMs: Math.round(result.runtimeMs),
        },
      });
    } catch {
      // optimizationRun may not exist in schema
    }

    return payloadForReport;
  }

  return { error: `Unknown tool: ${name}` };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AgentPayload.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error }, { status: 400 });
    }

    const { conversationId: existingId, userMessage, screen = "optimizer" } = parsed.data;
    let period = parsed.data.period;
    let objective = parsed.data.objective;
    let constraints = parsed.data.constraints;

    let convId = existingId;
    let summary = "";
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    let memoryDefaults: ExtractedPreferences | null = null;

    if (convId) {
      const ctx = await getAgentContext(convId);
      if (ctx) {
        summary = ctx.summary;
        memoryDefaults = ctx.memory as ExtractedPreferences;
        if (!period) period = ctx.memory.typicalPeriod as string;
        if (!objective) objective = ctx.memory.preferredObjective as Objective;
        if (!constraints && (Object.keys(ctx.memory.minSpendByRetailer).length || ctx.memory.retailerPriorities.length)) {
          constraints = {
            minSpendByRetailer: ctx.memory.minSpendByRetailer,
            ...(ctx.memory.excludeRetailers?.length ? { excludeRetailers: ctx.memory.excludeRetailers } : {}),
          };
        }
      }
      const conv = await prisma.conversation.findUnique({
        where: { id: convId },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
      });
      if (conv) {
        const recent = conv.messages.slice(-10);
        for (const m of recent) {
          if (m.role === "user" || m.role === "assistant" || m.role === "system") {
            messages.push({
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
            });
          }
        }
      }
    }

    period = period || "2026-Q2";
    objective = objective || "maximize_margin";

    if (!convId) {
      const conv = await prisma.conversation.create({
        data: { title: userMessage.slice(0, 80) },
      });
      convId = conv.id;
    }

    await prisma.message.create({
      data: { conversationId: convId, role: "user", content: userMessage },
    });

    const memHint = memoryDefaults
      ? ` Memory defaults: objective=${memoryDefaults.preferredObjective}, period=${memoryDefaults.typicalPeriod}${Object.keys(memoryDefaults.minSpendByRetailer || {}).length ? `, minSpend=${JSON.stringify(memoryDefaults.minSpendByRetailer)}` : ""}.`
      : "";

    const screenGoals: Record<string, string> = {
      overview: "Current screen: Overview. Goal: Provide high-level summary, aggregate KPIs, and at-a-glance allocation. Focus on totals and trends rather than deep optimization.",
      planner: "Current screen: Planner. Goal: Plan promotions across time. Focus on scheduling, timing, calendar, and promotion cadence. When optimizing, frame results as a plan (e.g. 'Plan to shift spend to X in weeks Y-Z').",
      optimizer: "Current screen: Optimizer. Goal: Optimize trade spend allocation. Focus on reallocation, scenario comparison, margin maximization, and ROI. Run runAgenticOptimization when user asks for recommendations.",
      reports: "Current screen: Reports. Goal: Summarize and report on optimization results. Provide clear, report-ready output.",
    };
    const screenGoal = screenGoals[screen] || screenGoals.optimizer;

    const dealTypesList = REYNOLDS_WALMART_DEAL_TYPES.map((d) => `${d.label} (${d.shortCode ?? d.id})`).join(", ");

    const systemContent = `You are a TPO analyst for Reynolds CP that continuously learns and adapts. ${screenGoal}

LEARNING: Use conversation history and stored preferences to adapt. When the user expresses preferences (e.g. "prioritize Walmart", "avoid deep discounts", "focus on margin"), remember them for future turns. Update your recommendations based on prior feedback.

Reynolds–Walmart deal types: ${dealTypesList}. Use these when discussing promotion scenarios.

Tools:
- getCurrentBudgets(period): fetch budget allocation
- runAgenticOptimization(period, objective, constraints, sims=1000): run 1000 simulations
- getCoverageNotes(): Circana coverage gaps
- saveScenario(name, scenarioPayload): save scenario

When user asks about reallocation or recommendations, call runAgenticOptimization with sims=1000.
Use period="${period}", objective="${objective}", constraints=${JSON.stringify(constraints || {})}.${memHint}

Return: (1) executive summary, (2) recommended allocation changes, (3) KPI impact, (4) confidence/risk, (5) explanation bullets, (6) "data needed to improve confidence" if gaps exist.`;

    messages.unshift({ role: "system", content: systemContent });
    messages.push({ role: "user", content: userMessage });

    const completion = await openai.chat.completions.create({
      model: (process.env.OPENAI_MODEL as string) || "gpt-4o-mini",
      messages,
      tools: TOOLS,
      tool_choice: "auto",
    });

    let assistantContent = "";
    let toolResult: unknown = null;
    const choice = completion.choices[0];

    if (choice?.message?.tool_calls?.length) {
      for (const tc of choice.message.tool_calls) {
        if (tc?.function?.name && tc.function.arguments) {
          const args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
          toolResult = await executeTool(tc.function.name, args, convId);
          assistantContent += `Tool ${tc.function.name} completed. `;
        }
      }
      if (toolResult && typeof toolResult === "object" && "topScenario" in (toolResult as object)) {
        const r = toolResult as { explanationBullets?: string[]; dataGapNote?: string | null };
        assistantContent += `Top scenario: ${(r.explanationBullets ?? []).join("; ")}. ${r.dataGapNote ?? ""}`;
      } else if (toolResult) {
        assistantContent += JSON.stringify(toolResult).slice(0, 400);
      }
    }

    if (!assistantContent && choice?.message?.content) {
      assistantContent = choice.message.content;
    }

    if (!assistantContent) {
      assistantContent = "Processed. Check tool results in the UI.";
    }

    const msgCount = await prisma.message.count({ where: { conversationId: convId } });
    if (msgCount >= 6) {
      try {
        const brief = await openai.chat.completions.create({
          model: (process.env.OPENAI_MODEL as string) || "gpt-4o-mini",
          messages: [
            { role: "system", content: "Summarize this TPO conversation in 2-3 sentences, max 800 chars." },
            ...messages.slice(1),
            { role: "assistant", content: assistantContent },
          ],
        });
        const newSummary = brief.choices[0]?.message?.content || "";
        await updateConversationSummary(convId, newSummary);
      } catch {
        // ignore summary failure
      }
    }

    try {
      const extractRes = await openai.chat.completions.create({
        model: (process.env.OPENAI_MODEL as string) || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Extract user preferences from this message as JSON: preferredObjective (maximize_margin|maximize_revenue|balanced), retailerPriorities (array), riskTolerance (low|medium|high), typicalPeriod, minSpendByRetailer (e.g. {"Sam's Club":6000000}), excludeRetailers. Reply ONLY with JSON or {} if none.`,
          },
          { role: "user", content: userMessage },
        ],
      });
      const raw = extractRes.choices[0]?.message?.content?.trim() || "{}";
      const cleaned = raw.replace(/```json?|```/g, "").trim();
      const extracted = JSON.parse(cleaned || "{}") as ExtractedPreferences;
      if (Object.keys(extracted).length > 0) {
        await updateAgentMemory(convId, extracted);
      }
    } catch {
      // ignore extraction failure
    }

    await prisma.message.create({
      data: { conversationId: convId, role: "assistant", content: assistantContent },
    });

    return NextResponse.json({
      conversationId: convId,
      assistantMessage: assistantContent,
      toolResult,
    });
  } catch (e) {
    console.error("Agent error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Agent failed" },
      { status: 500 }
    );
  }
}
