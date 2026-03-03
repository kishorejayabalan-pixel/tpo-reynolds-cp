import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { periodToDateRange } from "@/lib/repo/tpoRepo";
import { optimize } from "@/lib/tpo/optimize";
import type { SimPromoEvent, SimSKU, SimRetailer } from "@/lib/tpo/simulate";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

export interface ParsedConstraints {
  targetRevenue?: number;
  minRoi?: number;
  spendCap?: number;
  retailerNames?: string[];
  horizon?: string;
  horizonWeeks?: number;
}

const EXTRACT_SYSTEM = `You are a TPO constraint extractor. Extract from the user's message structured fields. Reply with ONLY a JSON object (no markdown, no explanation) with these optional keys:
- targetRevenue: number (e.g. 10000000 for $10M)
- minRoi: number (e.g. 1.25)
- spendCap: number (e.g. 1200000 for $1.2M)
- retailerNames: string[] (e.g. ["Walmart", "Kroger"])
- horizon: string (e.g. "2026-Q2", "Q2", "12 weeks")
- horizonWeeks: number (e.g. 12)
If something is not mentioned, omit the key.`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      message: string;
      conversationId?: string;
    };
    const { message } = body;
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    let conversationId = body.conversationId;
    if (!conversationId) {
      const conv = await prisma.conversation.create({
        data: { title: message.slice(0, 80) },
      });
      conversationId = conv.id;
    }

    await prisma.message.create({
      data: { conversationId, role: "user", content: message },
    });

    let parsed: ParsedConstraints = {};
    if (process.env.OPENAI_API_KEY) {
      const res = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: EXTRACT_SYSTEM },
          { role: "user", content: message },
        ],
      });
      const raw = res.choices[0]?.message?.content?.trim() ?? "{}";
      const cleaned = raw.replace(/```json?|```/g, "").trim();
      try {
        parsed = JSON.parse(cleaned || "{}") as ParsedConstraints;
      } catch {
        parsed = {};
      }
    }

    const period = (parsed.horizon && /^\d{4}-Q\d$/.test(parsed.horizon))
      ? parsed.horizon
      : parsed.horizon === "Q2" || parsed.horizon === "Q1" || parsed.horizon === "Q3" || parsed.horizon === "Q4"
        ? `2026-${parsed.horizon}`
        : "2026-Q2";
    const horizonWeeks = parsed.horizonWeeks ?? 12;
    const budget = parsed.spendCap;
    const minRoi = parsed.minRoi ?? 1.25;

    const retailers = await prisma.retailer.findMany({
      where:
        parsed.retailerNames?.length ?
          { name: { in: parsed.retailerNames } }
        : undefined,
      take: 1,
    });
    const retailerId = retailers[0]?.id;
    const anyRetailer = await prisma.retailer.findFirst();
    const targetId = retailerId ?? anyRetailer?.id;

    if (!targetId) {
      await prisma.message.create({
        data: {
          conversationId,
          role: "assistant",
          content: "No retailers in the database. Add retailers and try again.",
        },
      });
      return NextResponse.json({
        conversationId,
        reply: "No retailers in the database.",
        summary: "No retailers",
        runResult: null,
      });
    }

    let runResult: unknown = null;
    let summary = "No optimization run.";

    const { start } = periodToDateRange(period);
    const horizonEndDate = new Date(start);
    horizonEndDate.setDate(horizonEndDate.getDate() + horizonWeeks * 7);

    const [retailer, eventsRaw, skusRaw, budgetRow] = await Promise.all([
      prisma.retailer.findUnique({ where: { id: targetId } }),
      prisma.promoEvent.findMany({
        where: {
          retailerId: targetId,
          periodStart: { lte: horizonEndDate },
          periodEnd: { gte: start },
        },
        include: { sku: true },
      }),
      prisma.sKU.findMany({ orderBy: { skuCode: "asc" } }),
      prisma.budget.findFirst({
        where: { retailerId: targetId, period },
      }),
    ]);

    const budgetValue = budget ?? budgetRow?.spend ?? 5_000_000;

    if (retailer && eventsRaw.length > 0) {
      const events: SimPromoEvent[] = eventsRaw.map((e) => ({
        retailerId: e.retailerId,
        skuId: e.skuId,
        periodStart: new Date(e.periodStart),
        periodEnd: new Date(e.periodEnd),
        discountDepth: e.discountDepth,
        durationWeeks: e.durationWeeks,
        baselineUnits: e.baselineUnits,
        promoUnits: e.promoUnits,
        promoType: e.promoType,
        displaySupport: e.displaySupport,
        featureAd: e.featureAd,
        inventoryFlag: e.inventoryFlag,
      }));
      const skus: SimSKU[] = skusRaw.map((s) => ({
        id: s.id,
        skuCode: s.skuCode,
        category: s.category,
        brand: s.brand,
        unitCost: s.unitCost,
        basePrice: s.basePrice,
      }));
      const retailerSim: SimRetailer = { id: retailer.id, name: retailer.name };

      const result = optimize({
        events,
        skus,
        retailer: retailerSim,
        horizonWeeks,
        budget: budgetValue,
        minRoi,
      });

      runResult = {
        bestPlan: result.bestPlan ? { kpi: result.bestPlan.kpi } : null,
        feasibleCount: result.feasibleCount,
        totalCandidates: result.totalCandidates,
      };

      if (result.bestPlan) {
        summary = `Optimization for ${retailer.name}: revenue $${(result.bestPlan.kpi.revenue / 1e6).toFixed(2)}M, ROI ${result.bestPlan.kpi.roi.toFixed(2)}, spend $${(result.bestPlan.kpi.spend / 1e6).toFixed(2)}M.`;
      } else {
        summary = `No feasible plan for ${retailer.name} (ROI ≥ ${minRoi}, spend ≤ budget).`;
      }
    } else {
      summary = `No current plan for retailer. Run a seed or add promo events first.`;
    }

    const reply =
      summary +
      (parsed.targetRevenue
        ? ` Target revenue mentioned: $${(parsed.targetRevenue / 1e6).toFixed(1)}M.`
        : "");

    await prisma.message.create({
      data: { conversationId, role: "assistant", content: reply },
    });

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (conv) {
      const newSummary =
        summary.length > 800 ? summary.slice(0, 797) + "..." : summary;
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { summary: newSummary },
      });
    }

    return NextResponse.json({
      conversationId,
      reply,
      summary,
      parsed,
      runResult,
    });
  } catch (e) {
    console.error("POST /api/chat", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chat failed" },
      { status: 500 }
    );
  }
}
