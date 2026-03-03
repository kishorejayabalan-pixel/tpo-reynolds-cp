/**
 * Deterministic seed for Prisma.
 * 3 retailers, 25 SKUs, 120 promo events over 12 weeks, budgets by retailer/quarter.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED = 42;

/** Mulberry32 - deterministic RNG */
function createRng(seed: number) {
  return function next(): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

async function main() {
  const rng = createRng(SEED);

  // ─── 3 Retailers ───
  const retailers = [
    { name: "Walmart", channel: "Mass", circanaCoverage: false, priority: "High" },
    { name: "Sam's Club", channel: "Club", circanaCoverage: false, priority: "High" },
    { name: "Kroger", channel: "Grocery", circanaCoverage: true, priority: "Med" },
  ];

  for (const r of retailers) {
    await prisma.retailer.upsert({
      where: { name: r.name },
      update: r,
      create: r,
    });
  }

  const retailerRows = await prisma.retailer.findMany({ orderBy: { name: "asc" } });
  if (retailerRows.length < 3) throw new Error("Expected 3 retailers");

  // ─── 25 SKUs across Foil, Trash Bags, Food Storage ───
  const foilSkus = [
    { skuCode: "RW-75", category: "Foil", brand: "Reynolds", unitCost: 1.45, basePrice: 3.99 },
    { skuCode: "RW-200", category: "Foil", brand: "Reynolds", unitCost: 2.85, basePrice: 6.49 },
    { skuCode: "RW-125", category: "Foil", brand: "Reynolds", unitCost: 2.1, basePrice: 4.99 },
    { skuCode: "RW-HD75", category: "Foil", brand: "Reynolds", unitCost: 1.9, basePrice: 4.49 },
    { skuCode: "RW-HD50", category: "Foil", brand: "Reynolds", unitCost: 1.5, basePrice: 3.49 },
    { skuCode: "GF-60", category: "Foil", brand: "Reynolds", unitCost: 1.1, basePrice: 2.99 },
    { skuCode: "RW-PC30", category: "Foil", brand: "Reynolds", unitCost: 1.2, basePrice: 3.29 },
    { skuCode: "RW-PC60", category: "Foil", brand: "Reynolds", unitCost: 2.0, basePrice: 5.49 },
  ];
  const trashSkus = [
    { skuCode: "HT-13", category: "Trash Bags", brand: "Hefty", unitCost: 3.1, basePrice: 6.49 },
    { skuCode: "HT-45", category: "Trash Bags", brand: "Hefty", unitCost: 4.2, basePrice: 8.99 },
    { skuCode: "HT-60", category: "Trash Bags", brand: "Hefty", unitCost: 5.5, basePrice: 11.49 },
    { skuCode: "HT-CINCH30", category: "Trash Bags", brand: "Hefty", unitCost: 3.8, basePrice: 7.99 },
    { skuCode: "HT-CINCH45", category: "Trash Bags", brand: "Hefty", unitCost: 4.9, basePrice: 9.99 },
    { skuCode: "HT-STRONG50", category: "Trash Bags", brand: "Hefty", unitCost: 5.2, basePrice: 10.99 },
    { skuCode: "HT-SCENT20", category: "Trash Bags", brand: "Hefty", unitCost: 2.8, basePrice: 5.99 },
    { skuCode: "HT-8GAL24", category: "Trash Bags", brand: "Hefty", unitCost: 2.4, basePrice: 5.49 },
    { skuCode: "HT-4GAL20", category: "Trash Bags", brand: "Hefty", unitCost: 1.9, basePrice: 4.29 },
  ];
  const foodStorageSkus = [
    { skuCode: "HZ-QT", category: "Food Storage", brand: "Hefty", unitCost: 2.6, basePrice: 5.49 },
    { skuCode: "HZ-GAL", category: "Food Storage", brand: "Hefty", unitCost: 3.2, basePrice: 6.99 },
    { skuCode: "HZ-SAND", category: "Food Storage", brand: "Hefty", unitCost: 2.2, basePrice: 4.49 },
    { skuCode: "HZ-SNACK", category: "Food Storage", brand: "Hefty", unitCost: 1.8, basePrice: 3.99 },
    { skuCode: "HZ-FREEZER", category: "Food Storage", brand: "Hefty", unitCost: 2.9, basePrice: 5.99 },
    { skuCode: "HZ-VAC-QT", category: "Food Storage", brand: "Hefty", unitCost: 3.0, basePrice: 6.49 },
    { skuCode: "HZ-VAC-GAL", category: "Food Storage", brand: "Hefty", unitCost: 3.8, basePrice: 7.99 },
    { skuCode: "HZ-JUMBO", category: "Food Storage", brand: "Hefty", unitCost: 2.5, basePrice: 5.29 },
  ];

  const skuPayloads = [...foilSkus, ...trashSkus, ...foodStorageSkus];
  for (const s of skuPayloads) {
    await prisma.sKU.upsert({
      where: { skuCode: s.skuCode },
      update: { category: s.category, brand: s.brand, unitCost: s.unitCost, basePrice: s.basePrice },
      create: s,
    });
  }

  const skuRows = await prisma.sKU.findMany({ orderBy: { skuCode: "asc" } });
  if (skuRows.length < 25) throw new Error("Expected 25 SKUs");

  // ─── 120 Promo events over 12 weeks, mixed mechanics (TPR, BOGO, Display) ───
  const mechanics = ["TPR", "BOGO", "Display"] as const;
  const year = 2026;
  const weeks = 12;

  function weekToDate(weekIndex: number): Date {
    const d = new Date(year, 0, 1);
    d.setDate(d.getDate() + weekIndex * 7);
    return d;
  }

  for (let i = 0; i < 120; i++) {
    const retailer = pick(rng, retailerRows);
    const sku = pick(rng, skuRows);
    const mechanic = pick(rng, mechanics);
    const startWeek = randInt(rng, 0, weeks - 2);
    const durationWeeks = randInt(rng, 1, 3);
    const periodStart = weekToDate(startWeek);
    const periodEnd = weekToDate(startWeek + durationWeeks);
    const discountDepth =
      mechanic === "TPR" ? pick(rng, [0.1, 0.15, 0.2, 0.25]) : mechanic === "BOGO" ? 0.5 : 0.15;
    const baselineUnits = randInt(rng, 5000, 25000);
    const lift =
      mechanic === "Display"
        ? randInt(rng, 15, 35) / 100
        : mechanic === "BOGO"
          ? randInt(rng, 80, 150) / 100
          : randInt(rng, 25, 60) / 100;
    const promoUnits = Math.round(baselineUnits * (1 + lift));
    const inventoryFlag = rng() < 0.1 ? "LOW" : "OK";

    await prisma.promoEvent.create({
      data: {
        retailerId: retailer.id,
        skuId: sku.id,
        periodStart,
        periodEnd,
        discountDepth,
        durationWeeks,
        baselineUnits,
        promoUnits,
        inventoryFlag,
        promoType: mechanic,
        displaySupport: mechanic === "Display",
        featureAd: mechanic === "Display" && rng() < 0.3,
      },
    });
  }

  // ─── Budgets by retailer and quarter ───
  const quarters = ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"];
  const spendRanges: Record<string, [number, number]> = {
    Walmart: [4_000_000, 12_000_000],
    "Sam's Club": [1_500_000, 5_000_000],
    Kroger: [2_000_000, 6_000_000],
  };

  const existingBudgets = await prisma.budget.count();
  if (existingBudgets === 0) {
    for (const retailer of retailerRows) {
      const range = spendRanges[retailer.name] ?? [1_000_000, 3_000_000];
      const [min, max] = range;
      for (const period of quarters) {
        const spend = Math.round(min + rng() * (max - min));
        await prisma.budget.create({
          data: { retailerId: retailer.id, period, spend },
        });
      }
    }
  }

  console.log("Seed complete: 3 retailers, 25 SKUs, 120 promo events, budgets by retailer/quarter.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
