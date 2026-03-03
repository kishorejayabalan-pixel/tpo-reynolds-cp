/**
 * Reynolds Consumer Products — synthetic TPO seed
 * Aligns with SEC filings: Walmart ~31%, Sam's ~17%, trade spend 4–6%
 */

import { PrismaClient } from "@prisma/client";
import {
  computeLift,
  promoUnits,
  promoPrice,
  tradeSpend,
  promoRevenue,
  promoMargin,
  baseMargin,
  incrementalMargin,
  roi,
  tradeSpendPctOfRevenue,
  isTradeSpendCompliant,
  type PromoType,
} from "../src/lib/tpo/reynoldsMarginModel";

const prisma = new PrismaClient();

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

const REYNOLDS_SKUS = [
  { skuCode: "RW75", category: "Foil", brand: "Reynolds", productName: "Reynolds Wrap 75ft", unitCost: 2.1, basePrice: 5.49 },
  { skuCode: "RW200", category: "Foil", brand: "Reynolds", productName: "Reynolds Wrap 200ft", unitCost: 4.2, basePrice: 9.99 },
  { skuCode: "HT30", category: "Trash Bags", brand: "Hefty", productName: "Hefty Trash 30ct", unitCost: 3.4, basePrice: 7.99 },
  { skuCode: "HSQt", category: "Storage", brand: "Hefty", productName: "Hefty Storage Qt", unitCost: 2.8, basePrice: 5.99 },
  { skuCode: "RP", category: "Tableware", brand: "Reynolds", productName: "Reynolds Parchment", unitCost: 1.9, basePrice: 4.49 },
  { skuCode: "HSG", category: "Storage", brand: "Hefty", productName: "Hefty Slider Gallon", unitCost: 3.6, basePrice: 7.49 },
];

const REYNOLDS_RETAILERS = [
  { name: "Walmart", channel: "Mass", circanaCoverage: false, priority: "High" },
  { name: "Sam's Club", channel: "Club", circanaCoverage: false, priority: "High" },
  { name: "Kroger", channel: "Grocery", circanaCoverage: true, priority: "Med" },
  { name: "Target", channel: "Mass", circanaCoverage: true, priority: "Med" },
  { name: "Walgreens", channel: "Drug", circanaCoverage: true, priority: "Med" },
];

/** Base units per week by retailer (drives ~31% Walmart, ~17% Sam's) */
const BASE_UNITS_PER_WEEK: Record<string, { min: number; max: number }> = {
  Walmart: { min: 2500, max: 5000 },
  "Sam's Club": { min: 1800, max: 4000 },
  Kroger: { min: 1200, max: 2500 },
  Target: { min: 800, max: 2000 },
  Walgreens: { min: 500, max: 1200 },
};

/** ~60% None to keep trade spend 4–6%; rest All Price Off / Display / Feature / BOGO / Seasonal */
const PROMO_TYPES: PromoType[] = [
  "None", "None", "None", "None", "None", "None",
  "All Price Off", "All Price Off", "Display", "Feature", "BOGO", "Seasonal",
];

/** Discounts 0–20%. Trade spend % ≈ discount/(1-discount); need ~5% avg for 4–6% compliance. */
const DISCOUNT_PCTS = [
  0, 0, 0, 0, 0, 0, 0.03, 0.04, 0.05, 0.05, 0.06, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2,
];

async function main() {
  // Upsert retailers
  for (const r of REYNOLDS_RETAILERS) {
    await prisma.retailer.upsert({
      where: { name: r.name },
      update: r,
      create: r,
    });
  }

  // Upsert SKUs
  for (const s of REYNOLDS_SKUS) {
    await prisma.sKU.upsert({
      where: { skuCode: s.skuCode },
      update: {
        category: s.category,
        brand: s.brand,
        unitCost: s.unitCost,
        basePrice: s.basePrice,
      },
      create: {
        skuCode: s.skuCode,
        category: s.category,
        brand: s.brand,
        unitCost: s.unitCost,
        basePrice: s.basePrice,
      },
    });
  }

  const retailers = await prisma.retailer.findMany({
    where: { name: { in: REYNOLDS_RETAILERS.map((r) => r.name) } },
  });
  const skus = await prisma.sKU.findMany({
    where: { skuCode: { in: REYNOLDS_SKUS.map((s) => s.skuCode) } },
  });

  // Budgets for 2026-Q2 — scaled so Walmart ~31%, Sam's ~17% of total
  const revenueShare = { Walmart: 0.31, "Sam's Club": 0.17 };
  const otherShare = (1 - 0.31 - 0.17) / 3; // Kroger, Target, Walgreens
  const totalBudget = 50_000_000; // total trade budget for Q2
  const budgetByRetailer: Record<string, number> = {
    Walmart: Math.round(totalBudget * 0.31),
    "Sam's Club": Math.round(totalBudget * 0.17),
    Kroger: Math.round(totalBudget * otherShare),
    Target: Math.round(totalBudget * otherShare),
    Walgreens: Math.round(totalBudget * otherShare),
  };

  await prisma.budget.deleteMany({
    where: { period: "2026-Q2", retailerId: { in: retailers.map((r) => r.id) } },
  });
  for (const r of retailers) {
    await prisma.budget.create({
      data: {
        retailerId: r.id,
        period: "2026-Q2",
        spend: budgetByRetailer[r.name] ?? totalBudget / 5,
      },
    });
  }

  const periodStart = new Date(2026, 3, 1); // Apr 1
  const periodEnd = new Date(2026, 5, 30); // Jun 30
  const q2Weeks = 13;

  const skuMap = new Map(skus.map((s) => [s.skuCode, s]));
  const retailerMap = new Map(retailers.map((r) => [r.name, r]));

  // Generate 100+ promo events for 2026-Q2
  const eventsToCreate: {
    retailerId: string;
    skuId: string;
    periodStart: Date;
    periodEnd: Date;
    discountDepth: number;
    durationWeeks: number;
    baselineUnits: number;
    promoUnits: number;
    inventoryFlag: string;
    promoType: string;
    displaySupport: boolean;
    featureAd: boolean;
  }[] = [];

  let attempts = 0;
  const maxAttempts = 500;
  const targetEventCount = 120;

  while (eventsToCreate.length < targetEventCount && attempts < maxAttempts) {
    attempts++;
    const retailer = pick(retailers);
    const sku = pick(skus);
    const range = BASE_UNITS_PER_WEEK[retailer.name] ?? { min: 500, max: 2000 };
    const weeklyBase = randInt(range.min, range.max);
    const durationWeeks = randInt(2, 8);
    const baselineUnits = weeklyBase * durationWeeks;

    let promoType = pick(PROMO_TYPES);
    let discountPct = pick(DISCOUNT_PCTS);
    if (promoType === "None") discountPct = 0;
    if (promoType === "BOGO" || promoType === "Seasonal")
      discountPct = Math.max(discountPct, 0.06);

    const displaySupport = promoType !== "None" && Math.random() < 0.35;
    const featureAd = promoType !== "None" && Math.random() < 0.3;
    if (promoType === "Display" && !displaySupport) promoType = "All Price Off";
    if (promoType === "Feature" && !featureAd) promoType = "All Price Off";

    const lift = computeLift(
      promoType as PromoType,
      discountPct,
      displaySupport,
      featureAd,
      Math.random
    );
    const promoUnitsVal = promoUnits(baselineUnits, lift);

    const startWeek = randInt(0, Math.max(0, q2Weeks - durationWeeks));
    const start = new Date(periodStart);
    start.setDate(start.getDate() + startWeek * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + durationWeeks * 7);

    eventsToCreate.push({
      retailerId: retailer.id,
      skuId: sku.id,
      periodStart: start,
      periodEnd: end,
      discountDepth: discountPct,
      durationWeeks,
      baselineUnits,
      promoUnits: promoUnitsVal,
      inventoryFlag: Math.random() < 0.12 ? "LOW" : "OK",
      promoType,
      displaySupport,
      featureAd,
    });
  }

  // Delete existing 2026-Q2 promo events for these retailers to avoid duplicates
  const retailerIds = retailers.map((r) => r.id);
  await prisma.promoEvent.deleteMany({
    where: {
      retailerId: { in: retailerIds },
      periodStart: { lte: periodEnd },
      periodEnd: { gte: periodStart },
    },
  });

  for (const evt of eventsToCreate) {
    await prisma.promoEvent.create({ data: evt });
  }

  // Validation: compute trade spend % and retailer revenue mix
  const allEvents = await prisma.promoEvent.findMany({
    where: {
      retailerId: { in: retailerIds },
      periodStart: { lte: periodEnd },
      periodEnd: { gte: periodStart },
    },
    include: { sku: true, retailer: true },
  });

  let totalRevenue = 0;
  let totalTradeSpend = 0;
  const revenueByRetailer: Record<string, number> = {};

  for (const e of allEvents) {
    const rev = promoRevenue(e.sku.basePrice, e.discountDepth, e.promoUnits);
    const spend = tradeSpend(e.sku.basePrice, e.promoUnits, e.discountDepth);
    totalRevenue += rev;
    totalTradeSpend += spend;
    revenueByRetailer[e.retailer.name] = (revenueByRetailer[e.retailer.name] ?? 0) + rev;
  }

  const tradeSpendPct = tradeSpendPctOfRevenue(totalTradeSpend, totalRevenue);

  console.log("\n=== Reynolds Seed Complete ===");
  console.log(`Events created: ${eventsToCreate.length}`);
  console.log(`Total revenue (Q2): $${(totalRevenue / 1e6).toFixed(2)}M`);
  console.log(`Total trade spend: $${(totalTradeSpend / 1e6).toFixed(2)}M`);
  console.log(`Trade spend %: ${(tradeSpendPct * 100).toFixed(2)}%`);
  console.log(`Compliant (4–6%): ${isTradeSpendCompliant(tradeSpendPct) ? "YES" : "NO"}`);
  console.log("\nRevenue mix:");
  for (const [name, rev] of Object.entries(revenueByRetailer).sort((a, b) => b[1] - a[1])) {
    const pct = ((rev / totalRevenue) * 100).toFixed(1);
    console.log(`  ${name}: ${pct}%`);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
