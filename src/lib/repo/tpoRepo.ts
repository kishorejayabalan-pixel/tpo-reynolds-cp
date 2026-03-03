import { prisma } from "../db";

export async function getRetailers() {
  try {
    return await prisma.retailer.findMany({ orderBy: { name: "asc" } });
  } catch {
    return [];
  }
}

export async function getBudgets(period: string) {
  try {
    const model = (prisma as Record<string, { findMany?: (args: unknown) => Promise<unknown> }>).budget;
    if (!model?.findMany) return [];
    return (await model.findMany({
      where: { period },
      include: { retailer: true },
    })) as Array<{ retailerId: string; retailer: { name: string }; spend: number; period: string }>;
  } catch {
    return [];
  }
}

export async function getPromoEventsInRange(start: Date, end: Date) {
  try {
    return await prisma.promoEvent.findMany({
      where: {
        periodStart: { lte: end },
        periodEnd: { gte: start },
      },
      include: { sku: true, retailer: true },
    });
  } catch {
    return [];
  }
}

export async function getSkus() {
  return prisma.sKU.findMany({ orderBy: { skuCode: "asc" } });
}

/** Build response curve: retailerName -> margin per $ spent (approximate) */
export function buildResponseCurve(
  promoEvents: Awaited<ReturnType<typeof getPromoEventsInRange>>,
  budgets: Awaited<ReturnType<typeof getBudgets>>
): Record<string, number> {
  const curve: Record<string, number> = {};
  const retailerIds = new Set(budgets.map((b) => b.retailerId));

  for (const b of budgets) {
    const name = b.retailer.name;
    const events = promoEvents.filter((e) => e.retailerId === b.retailerId);
    if (events.length === 0) {
      curve[name] = 0.12;
      continue;
    }
    let totalIncMargin = 0;
    let totalSpend = 0;
    for (const e of events) {
      const incUnits = e.promoUnits - e.baselineUnits;
      const netPrice = e.sku.basePrice * (1 - e.discountDepth);
      const unitMargin = netPrice - e.sku.unitCost;
      totalIncMargin += incUnits * unitMargin;
      totalSpend += e.promoUnits * e.sku.unitCost;
    }
    curve[name] = totalSpend > 0 ? totalIncMargin / totalSpend : 0.12;
  }

  return curve;
}

/** Convert PromoEvents to ReynoldsEventInput for simulation */
export function toReynoldsEventInput(
  events: Awaited<ReturnType<typeof getPromoEventsInRange>>
): import("../tpo/reynoldsSimulation").ReynoldsEventInput[] {
  return events.map((e) => ({
    retailerId: e.retailerId,
    retailerName: e.retailer.name,
    skuId: e.skuId,
    skuCode: e.sku.skuCode,
    basePrice: e.sku.basePrice,
    unitCost: e.sku.unitCost,
    baselineUnits: e.baselineUnits,
    durationWeeks: e.durationWeeks,
  }));
}

/** Get date range for period string (e.g. "2026-Q2", "2026-03", "2026") */
export function periodToDateRange(period: string): { start: Date; end: Date } {
  if (period.includes("Q")) {
    const [year, q] = period.split("-Q").map(Number);
    const startMonth = (q - 1) * 3;
    return {
      start: new Date(year, startMonth, 1),
      end: new Date(year, startMonth + 3, 0),
    };
  }
  const parts = period.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  if (month != null) {
    return {
      start: new Date(year, month - 1, 1),
      end: new Date(year, month, 0),
    };
  }
  return {
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31),
  };
}
