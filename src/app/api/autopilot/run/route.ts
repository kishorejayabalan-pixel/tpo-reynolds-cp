import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  simulate,
  type SimulateKPI,
  type SimPromoEvent,
  type SimSKU,
  type SimRetailer,
} from "@/lib/tpo/simulate";
import { optimize } from "@/lib/tpo/optimize";

const HORIZON_WEEKS = 12;
const ROI_TARGET = 1.25;
const STOCKOUT_RISK_THRESHOLD = 0.2;
const COMPETITOR_DROP_THRESHOLD_PCT = -5;
const SIGNALS_LOOKBACK = 20;
const PERIOD = "2026-Q2";

function periodStart(): Date {
  return new Date(2026, 3, 1); // Q2 start
}

function horizonEnd(): Date {
  const s = periodStart();
  s.setDate(s.getDate() + HORIZON_WEEKS * 7);
  return s;
}

export async function POST() {
  try {
    const [signals, retailers] = await Promise.all([
      prisma.signalTick.findMany({
        orderBy: { createdAt: "desc" },
        take: SIGNALS_LOOKBACK,
      }),
      prisma.retailer.findMany({ select: { id: true, name: true } }),
    ]);

    const start = periodStart();
    const end = horizonEnd();
    const triggeredRetailerIds = new Set<string>();
    const baselineKpis: Record<string, SimulateKPI> = {};
    const triggerReasons: Record<string, string[]> = {};

    const addReason = (id: string, reason: string) => {
      if (!triggerReasons[id]) triggerReasons[id] = [];
      if (!triggerReasons[id].includes(reason)) triggerReasons[id].push(reason);
    };

    for (const sig of signals) {
      if (sig.type === "competitor_drop") {
        const payload = JSON.parse(sig.payload) as {
          competitorIndexDeltaPct?: number;
        };
        const delta = payload.competitorIndexDeltaPct ?? 0;
        if (delta < COMPETITOR_DROP_THRESHOLD_PCT) {
          if (sig.retailerId) {
            triggeredRetailerIds.add(sig.retailerId);
            addReason(sig.retailerId, "competitor price index drop");
          } else {
            retailers.forEach((r) => {
              triggeredRetailerIds.add(r.id);
              addReason(r.id, "competitor price index drop");
            });
          }
        }
      }
    }

    const applied: string[] = [];
    const skipped: string[] = [];

    for (const retailer of retailers) {
      const eventsRaw = await prisma.promoEvent.findMany({
        where: {
          retailerId: retailer.id,
          periodStart: { lte: end },
          periodEnd: { gte: start },
        },
        include: { sku: true },
      });

      if (eventsRaw.length === 0) {
        skipped.push(retailer.name);
        continue;
      }

      const skusRaw = await prisma.sKU.findMany({ orderBy: { skuCode: "asc" } });
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

      const kpi = simulate({
        events,
        skus,
        retailer: retailerSim,
        horizonWeeks: HORIZON_WEEKS,
        seed: 42,
        nDraws: 200,
      });

      baselineKpis[retailer.id] = kpi;

      if (kpi.stockoutRisk > STOCKOUT_RISK_THRESHOLD) {
        triggeredRetailerIds.add(retailer.id);
        addReason(retailer.id, "stockout risk above threshold");
      }

      const state = await prisma.autopilotState.findUnique({
        where: { retailerId: retailer.id },
      });
      const lastRoiBelow = state?.lastRoiBelowTarget ?? false;
      const currentRoiBelow = kpi.roi < ROI_TARGET;
      if (currentRoiBelow && lastRoiBelow) {
        triggeredRetailerIds.add(retailer.id);
        addReason(retailer.id, "ROI below target 2 ticks");
      }

      await prisma.autopilotState.upsert({
        where: { retailerId: retailer.id },
        create: { retailerId: retailer.id, lastRoiBelowTarget: currentRoiBelow },
        update: { lastRoiBelowTarget: currentRoiBelow },
      });
    }

    for (const retailerId of triggeredRetailerIds) {
      const retailer = retailers.find((r) => r.id === retailerId);
      if (!retailer) continue;

      const eventsRaw = await prisma.promoEvent.findMany({
        where: {
          retailerId,
          periodStart: { lte: end },
          periodEnd: { gte: start },
        },
        include: { sku: true },
      });
      if (eventsRaw.length === 0) continue;

      const skusRaw = await prisma.sKU.findMany({ orderBy: { skuCode: "asc" } });
      const budgetRow = await prisma.budget.findFirst({
        where: { retailerId, period: PERIOD },
      });
      const budget = budgetRow?.spend ?? 5_000_000;

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
        horizonWeeks: HORIZON_WEEKS,
        budget,
        nCandidates: 30,
      });

      if (!result.bestPlan) {
        skipped.push(retailer.name);
        continue;
      }

      await prisma.promoEvent.deleteMany({
        where: {
          retailerId,
          periodStart: { gte: start },
          periodEnd: { lte: end },
        },
      });

      const skuIds = new Set(skusRaw.map((s) => s.id));
      for (const ev of result.bestPlan.plan) {
        if (!skuIds.has(ev.skuId)) continue;
        await prisma.promoEvent.create({
          data: {
            retailerId: ev.retailerId,
            skuId: ev.skuId,
            periodStart: ev.periodStart,
            periodEnd: ev.periodEnd,
            discountDepth: ev.discountDepth,
            durationWeeks: ev.durationWeeks,
            baselineUnits: ev.baselineUnits,
            promoUnits: Math.round(ev.baselineUnits * 1.2),
            inventoryFlag: ev.inventoryFlag,
            promoType: ev.promoType,
            displaySupport: ev.displaySupport,
            featureAd: ev.featureAd,
          },
        });
      }

      const beforeKpi = baselineKpis[retailerId];
      const afterKpi = result.bestPlan.kpi;
      const diff = beforeKpi
        ? {
            revenueDelta: afterKpi.revenue - beforeKpi.revenue,
            marginDelta: afterKpi.margin - beforeKpi.margin,
            roiDelta: afterKpi.roi - beforeKpi.roi,
            spendDelta: afterKpi.spend - beforeKpi.spend,
            stockoutRiskDelta:
              afterKpi.stockoutRisk - beforeKpi.stockoutRisk,
          }
        : null;

      const explanation = triggerReasons[retailerId]?.join("; ") ?? "autopilot_trigger";
      const top5Summary = result.top5.slice(0, 5).map((p) => ({ kpi: p.kpi }));

      await prisma.decisionLog.create({
        data: {
          retailerId,
          agent: "autopilot",
          action: "apply_optimized_plan",
          reason: explanation,
          beforeKpiJson: beforeKpi
            ? JSON.stringify(beforeKpi)
            : JSON.stringify({}),
          afterKpiJson: JSON.stringify(afterKpi),
          diff: diff ? JSON.stringify(diff) : null,
          signalContext: JSON.stringify({
            signals: signals.length,
            period: PERIOD,
          }),
          signals: JSON.stringify(signals.slice(0, SIGNALS_LOOKBACK).map((s) => ({ type: s.type, retailerId: s.retailerId, payload: s.payload }))),
          constraints: JSON.stringify({ roiTarget: ROI_TARGET, stockoutRiskThreshold: STOCKOUT_RISK_THRESHOLD }),
          kpiBefore: beforeKpi ? JSON.stringify(beforeKpi) : null,
          kpiAfter: JSON.stringify(afterKpi),
          top5: JSON.stringify(top5Summary),
          explanation,
        },
      });

      applied.push(retailer.name);
    }

    return NextResponse.json({
      triggered: Array.from(triggeredRetailerIds).length,
      applied,
      skipped,
      message: applied.length
        ? `Autopilot applied new plans for: ${applied.join(", ")}`
        : "No changes applied.",
    });
  } catch (e) {
    console.error("POST /api/autopilot/run", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Autopilot run failed" },
      { status: 500 }
    );
  }
}
