import { PrismaClient } from "@prisma/client";
import { REYNOLDS_WALMART_DEAL_TYPES } from "../src/lib/tpo/dealTypes";

const prisma = new PrismaClient();

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

const PROMO_TYPES = REYNOLDS_WALMART_DEAL_TYPES.map((d) => d.id);

async function main() {
  const retailers = [
    { name: "Kroger", channel: "Grocery", circanaCoverage: true, priority: "Med" },
    { name: "Walgreens", channel: "Drug", circanaCoverage: true, priority: "Med" },
    { name: "Target", channel: "Mass", circanaCoverage: true, priority: "Med" },
    { name: "Dollar General", channel: "Value", circanaCoverage: true, priority: "Med" },
    { name: "Walmart", channel: "Mass", circanaCoverage: false, priority: "High" },
    { name: "Sam's Club", channel: "Club", circanaCoverage: false, priority: "High" },
    { name: "Amazon", channel: "Ecom", circanaCoverage: false, priority: "High" },
    { name: "Costco", channel: "Club", circanaCoverage: false, priority: "High" },
    { name: "Aldi", channel: "Grocery", circanaCoverage: false, priority: "Med" },
    { name: "Trader Joe's", channel: "Grocery", circanaCoverage: false, priority: "Med" },
  ];

  const skuList = [
    { skuCode: "SKU001", category: "Food Wrap", brand: "Reynolds", unitCost: 1.45, basePrice: 3.99 },
    { skuCode: "SKU002", category: "Trash Bags", brand: "Hefty", unitCost: 3.1, basePrice: 6.49 },
    { skuCode: "SKU003", category: "Foil", brand: "Reynolds", unitCost: 2.2, basePrice: 4.99 },
    { skuCode: "SKU004", category: "Storage Bags", brand: "Hefty", unitCost: 2.6, basePrice: 5.49 },
    { skuCode: "SKU005", category: "Parchment Paper", brand: "Reynolds", unitCost: 1.9, basePrice: 4.49 },
  ];

  for (const r of retailers) {
    await prisma.retailer.upsert({
      where: { name: r.name },
      update: r,
      create: r,
    });
  }

  for (const s of skuList) {
    await prisma.sKU.upsert({
      where: { skuCode: s.skuCode },
      update: s,
      create: s,
    });
  }

  const allRetailers = await prisma.retailer.findMany();
  const allSkus = await prisma.sKU.findMany();

  const periods = ["2026-03", "2026-Q2", "2026"];
  for (const period of periods) {
    for (const r of allRetailers) {
      await prisma.budget.create({
        data: { retailerId: r.id, period, spend: randInt(2_000_000, 18_000_000) },
      });
    }
  }

  const depths = [0.05, 0.1, 0.15, 0.2, 0.25];

  // Walmart-focused scenario: extra deals for Reynolds' largest retail partner
  const walmartId = allRetailers.find((r) => r.name === "Walmart")?.id;
  const reynoldsSkus = allSkus.filter((s) => s.brand === "Reynolds");

  for (let i = 0; i < 80; i++) {
    const retailer = pick(allRetailers);
    const sku = pick(allSkus);
    const promoType = pick(PROMO_TYPES);
    const depth = pick(depths);
    const weeks = pick([1, 2, 3, 4]);

    const baseline = randInt(8_000, 30_000);
    const liftBase =
      retailer.name === "Walmart" ? 6.0 : retailer.name.includes("Club") ? 3.8 : 4.6;
    const liftFactor = 1 + depth * liftBase + (Math.random() * 0.25 - 0.1);

    const promoUnits = Math.max(baseline, Math.floor(baseline * liftFactor));
    const invFlag = Math.random() < 0.12 ? "LOW" : "OK";

    const start = new Date(2026, randInt(0, 11), randInt(1, 28));
    const end = new Date(start);
    end.setDate(end.getDate() + weeks * 7);

    await prisma.promoEvent.create({
      data: {
        retailerId: retailer.id,
        skuId: sku.id,
        periodStart: start,
        periodEnd: end,
        discountDepth: depth,
        durationWeeks: weeks,
        baselineUnits: baseline,
        promoUnits,
        inventoryFlag: invFlag,
        promoType,
        displaySupport: promoType.includes("display") || promoType === "da" || promoType === "end_cap",
        featureAd: promoType === "feature_ad" || promoType === "aa",
      },
    });
  }

  // Explicit Walmart–Reynolds deal scenarios (realistic trade promotion structures)
  const walmartScenarios = [
    { skuCode: "SKU001", promoType: "off_invoice", depth: 0.12, weeks: 4, baseline: 22000 },
    { skuCode: "SKU003", promoType: "display", depth: 0.1, weeks: 2, baseline: 18000 },
    { skuCode: "SKU005", promoType: "feature_ad", depth: 0.15, weeks: 3, baseline: 12000 },
    { skuCode: "SKU001", promoType: "bogo", depth: 0.5, weeks: 2, baseline: 24000 },
    { skuCode: "SKU003", promoType: "tpr_15", depth: 0.15, weeks: 4, baseline: 19000 },
    { skuCode: "SKU005", promoType: "scan_back", depth: 0.15, weeks: 4, baseline: 14000 },
    { skuCode: "SKU001", promoType: "aa", depth: 0.05, weeks: 8, baseline: 20000 },
    { skuCode: "SKU003", promoType: "end_cap", depth: 0.14, weeks: 2, baseline: 21000 },
    { skuCode: "SKU001", promoType: "da", depth: 0.08, weeks: 4, baseline: 22000 },
    { skuCode: "SKU005", promoType: "eb", depth: 0.04, weeks: 12, baseline: 10000 },
  ];

  if (walmartId && reynoldsSkus.length > 0) {
    for (const s of walmartScenarios) {
      const sku = allSkus.find((k) => k.skuCode === s.skuCode) ?? pick(allSkus);
      const liftFactor = 1 + s.depth * 6 + (Math.random() * 0.2 - 0.05);
      const promoUnits = Math.max(s.baseline, Math.floor(s.baseline * liftFactor));
      const start = new Date(2026, 1, randInt(1, 14)); // Q1 2026
      const end = new Date(start);
      end.setDate(end.getDate() + s.weeks * 7);

      await prisma.promoEvent.create({
        data: {
          retailerId: walmartId,
          skuId: sku.id,
          periodStart: start,
          periodEnd: end,
          discountDepth: s.depth,
          durationWeeks: s.weeks,
          baselineUnits: s.baseline,
          promoUnits,
          inventoryFlag: "OK",
          promoType: s.promoType,
          displaySupport: ["display", "da", "end_cap"].includes(s.promoType),
          featureAd: ["feature_ad", "aa"].includes(s.promoType),
        },
      });
    }
  }

  // Additional 30 events across other retailers with deal types
  for (let i = 0; i < 30; i++) {
    const retailer = pick(allRetailers.filter((r) => r.name !== "Walmart"));
    const sku = pick(allSkus);
    const promoType = pick(PROMO_TYPES);
    const depth = pick(depths);
    const weeks = pick([1, 2, 3, 4]);

    const baseline = randInt(8_000, 30_000);
    const liftBase = 4.6;
    const liftFactor = 1 + depth * liftBase + (Math.random() * 0.2 - 0.1);

    const promoUnits = Math.max(baseline, Math.floor(baseline * liftFactor));
    const invFlag = Math.random() < 0.12 ? "LOW" : "OK";

    const start = new Date(2026, randInt(0, 11), randInt(1, 28));
    const end = new Date(start);
    end.setDate(end.getDate() + weeks * 7);

    await prisma.promoEvent.create({
      data: {
        retailerId: retailer.id,
        skuId: sku.id,
        periodStart: start,
        periodEnd: end,
        discountDepth: depth,
        durationWeeks: weeks,
        baselineUnits: baseline,
        promoUnits,
        inventoryFlag: invFlag,
        promoType,
        displaySupport: promoType.includes("display") || promoType === "da" || promoType === "end_cap",
        featureAd: promoType === "feature_ad" || promoType === "aa",
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
