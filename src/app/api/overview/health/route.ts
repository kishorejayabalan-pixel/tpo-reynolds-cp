import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function computeRoi(spend: number, margin: number): number {
  return spend > 0 ? margin / spend : 0;
}

const Q2_2026_START = new Date(2026, 3, 1);
function getWeekIndex(d: Date): number {
  return Math.max(0, Math.floor((d.getTime() - Q2_2026_START.getTime()) / (7 * 24 * 60 * 60 * 1000)));
}

/** GET /api/overview/health?scenarioId=&retailerId= - Plan Health: meters + topIssues */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scenarioIdParam = searchParams.get("scenarioId");
    const retailerId = searchParams.get("retailerId") ?? undefined;

    let scenarioId = scenarioIdParam ?? null;
    if (!scenarioId) {
      const baseline = await prisma.scenario.findFirst({
        where: { name: "Baseline Plan" },
        select: { id: true },
      });
      scenarioId = baseline?.id ?? null;
    }

    const roiFloor = 1.2;
    const riskMax = 0.15;
    const spendCapDefault = 3_000_000;

    if (!scenarioId) {
      return NextResponse.json({
        spendUsed: 0,
        spendCap: spendCapDefault,
        spendUtilization: 0,
        roiCurrent: 0,
        roiFloor,
        roiStatus: "unknown",
        riskCurrent: 0,
        riskMax,
        riskStatus: "unknown",
        topIssues: [],
      });
    }

    const events = await prisma.promoEvent.findMany({
      where: { scenarioId, ...(retailerId ? { retailerId } : {}) },
      include: { sku: true, retailer: true },
    });

    let spendUsed = 0;
    let totalMargin = 0;
    const eventRows: Array<{
      id: string;
      skuCode: string;
      skuName: string;
      weekIndex: number;
      spend: number;
      margin: number;
      roi: number;
      inventoryFlag: string;
      riskScore: number;
    }> = [];

    for (const e of events) {
      const spend = e.promoUnits * e.sku.basePrice * e.discountDepth;
      const revenue = e.promoUnits * e.sku.basePrice * (1 - e.discountDepth);
      const cogs = e.promoUnits * e.sku.unitCost;
      const margin = revenue - cogs - spend;
      const roi = computeRoi(spend, margin);
      spendUsed += spend;
      totalMargin += margin;
      const riskScore = e.inventoryFlag === "LOW" ? 0.25 : 0.08;
      eventRows.push({
        id: e.id,
        skuCode: e.sku.skuCode,
        skuName: (e.sku as { name?: string }).name?.trim() ? (e.sku as { name: string }).name : e.sku.skuCode,
        weekIndex: getWeekIndex(e.periodStart),
        spend,
        margin,
        roi,
        inventoryFlag: e.inventoryFlag,
        riskScore,
      });
    }

    const spendCap = spendCapDefault;
    const spendUtilization = spendCap > 0 ? spendUsed / spendCap : 0;
    const roiCurrent = spendUsed > 0 ? totalMargin / spendUsed : 0;
    const riskCurrent = eventRows.length
      ? eventRows.reduce((a, r) => a + r.riskScore, 0) / eventRows.length
      : 0;

    const roiStatus = roiCurrent >= roiFloor ? "safe" : roiCurrent >= roiFloor * 0.9 ? "warning" : "breach";
    const riskStatus = riskCurrent <= riskMax ? "safe" : riskCurrent <= riskMax * 1.2 ? "warning" : "breach";
    const spendStatus = spendUtilization <= 0.9 ? "safe" : spendUtilization <= 1 ? "warning" : "breach";

    const lowRoiEvents = eventRows.filter((r) => r.roi < roiFloor && r.spend > 100);
    const highRiskEvents = eventRows.filter((r) => r.inventoryFlag === "LOW" || r.riskScore > riskMax);
    const overspendWeeks = new Map<number, number>();
    for (const r of eventRows) {
      overspendWeeks.set(r.weekIndex, (overspendWeeks.get(r.weekIndex) ?? 0) + r.spend);
    }
    const topIssues: Array<{
      sku: string;
      weeks: number[];
      issueType: string;
      suggestedFix: string;
      confidence: number;
    }> = [];
    const seen = new Set<string>();
    for (const r of lowRoiEvents.slice(0, 4)) {
      const key = `${r.skuCode}-roi`;
      if (!seen.has(key)) {
        seen.add(key);
        topIssues.push({
          sku: r.skuName,
          weeks: [r.weekIndex + 1],
          issueType: "ROI breach",
          suggestedFix: "Swap mechanic or reduce discount depth",
          confidence: 0.85,
        });
      }
    }
    for (const r of highRiskEvents.slice(0, 3)) {
      const key = `${r.skuCode}-${r.weekIndex}-risk`;
      if (!seen.has(key)) {
        seen.add(key);
        topIssues.push({
          sku: r.skuName,
          weeks: [r.weekIndex + 1],
          issueType: "Stockout risk",
          suggestedFix: "Shift promo later or reduce depth",
          confidence: 0.8,
        });
      }
    }
    for (const [week, sp] of overspendWeeks.entries()) {
      if (sp > spendCap / 8 && topIssues.length < 10) {
        topIssues.push({
          sku: "Multiple",
          weeks: [week + 1],
          issueType: "Overspend",
          suggestedFix: "Reallocate to higher-ROI weeks",
          confidence: 0.75,
        });
      }
    }
    topIssues.splice(10);

    return NextResponse.json({
      spendUsed,
      spendCap,
      spendUtilization,
      spendStatus,
      roiCurrent,
      roiFloor,
      roiStatus,
      riskCurrent,
      riskMax,
      riskStatus,
      topIssues,
    });
  } catch (e) {
    console.error("GET /api/overview/health", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Health check failed" },
      { status: 500 }
    );
  }
}
