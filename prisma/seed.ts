/**
 * Deterministic seed for Prisma.
 * 10 retailers, 60 SKUs (Reynolds CP portfolio), 4 scenarios × 300 PromoEvents, SignalTicks.
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

  // ─── 10 Retailers (enterprise channel mix) ───
  const retailers = [
    { name: "Kroger", channel: "Grocery", circanaCoverage: true, priority: "High" },
    { name: "Albertsons", channel: "Grocery", circanaCoverage: true, priority: "Med" },
    { name: "Walmart", channel: "Mass", circanaCoverage: true, priority: "High" },
    { name: "Target", channel: "Mass", circanaCoverage: true, priority: "High" },
    { name: "Sam's Club", channel: "Club", circanaCoverage: false, priority: "High" },
    { name: "Costco", channel: "Club", circanaCoverage: false, priority: "High" },
    { name: "Walgreens", channel: "Drug", circanaCoverage: true, priority: "Med" },
    { name: "Dollar General", channel: "Dollar", circanaCoverage: true, priority: "Med" },
    { name: "Amazon", channel: "Ecomm", circanaCoverage: false, priority: "Med" },
    { name: "Aldi", channel: "Discount", circanaCoverage: true, priority: "Med" },
  ];

  for (const r of retailers) {
    await prisma.retailer.upsert({
      where: { name: r.name },
      update: r,
      create: r,
    });
  }

  const retailerRows = await prisma.retailer.findMany({ orderBy: { name: "asc" } });
  if (retailerRows.length < 10) throw new Error("Expected 10 retailers");

  // ─── 60 SKUs: COOKING_BAKING (18), WASTE_STORAGE (22), TABLEWARE (10), PRESTO_VALUE (10) ───
  const cookingBaking: Array<{ skuCode: string; category: string; name: string; unitCost: number; basePrice: number }> = [
    { skuCode: "RW-75", category: "FOIL", name: "Reynolds Wrap Heavy Duty Foil 75 sq ft", unitCost: 1.45, basePrice: 3.99 },
    { skuCode: "RW-200", category: "FOIL", name: "Reynolds Wrap Standard Foil 200 sq ft", unitCost: 2.85, basePrice: 6.49 },
    { skuCode: "RW-125", category: "FOIL", name: "Reynolds Wrap Foil 125 sq ft", unitCost: 2.1, basePrice: 4.99 },
    { skuCode: "RW-HD75", category: "FOIL", name: "Reynolds Heavy Duty Foil 75 sq ft", unitCost: 1.9, basePrice: 4.49 },
    { skuCode: "RW-HD50", category: "FOIL", name: "Reynolds Heavy Duty Foil 50 sq ft", unitCost: 1.5, basePrice: 3.49 },
    { skuCode: "GF-60", category: "FOIL", name: "Reynolds Grill Foil 60 sq ft", unitCost: 1.1, basePrice: 2.99 },
    { skuCode: "RW-PC30", category: "PARCHMENT", name: "Reynolds Parchment 30 sq ft", unitCost: 1.2, basePrice: 3.29 },
    { skuCode: "RW-PC60", category: "PARCHMENT", name: "Reynolds Parchment 60 sq ft", unitCost: 2.0, basePrice: 5.49 },
    { skuCode: "RW-PC45", category: "PARCHMENT", name: "Reynolds Parchment 45 sq ft", unitCost: 1.6, basePrice: 4.29 },
    { skuCode: "RW-PW90", category: "PLASTIC_WRAP", name: "Reynolds Plastic Wrap 90 sq ft", unitCost: 1.3, basePrice: 3.49 },
    { skuCode: "RW-PW200", category: "PLASTIC_WRAP", name: "Reynolds Plastic Wrap 200 sq ft", unitCost: 2.4, basePrice: 5.99 },
    { skuCode: "RW-PW300", category: "PLASTIC_WRAP", name: "Reynolds Plastic Wrap 300 sq ft", unitCost: 3.2, basePrice: 7.99 },
    { skuCode: "RW-OB6", category: "OVEN_BAGS", name: "Reynolds Oven Bags 6 ct", unitCost: 2.1, basePrice: 4.99 },
    { skuCode: "RW-OB14", category: "OVEN_BAGS", name: "Reynolds Oven Bags 14 ct", unitCost: 3.5, basePrice: 7.49 },
    { skuCode: "RW-LINER20", category: "OVEN_BAGS", name: "Reynolds Oven Liner 20 ct", unitCost: 2.8, basePrice: 6.29 },
    { skuCode: "RW-FOIL18", category: "FOIL", name: "Reynolds Foil 18 in 50 sq ft", unitCost: 2.5, basePrice: 5.99 },
    { skuCode: "RW-FOIL12", category: "FOIL", name: "Reynolds Foil 12 in 75 sq ft", unitCost: 1.8, basePrice: 4.29 },
    { skuCode: "RW-PARCH30", category: "PARCHMENT", name: "Reynolds Parchment Sheets 30 ct", unitCost: 1.4, basePrice: 3.79 },
  ];

  const wasteStorage: Array<{ skuCode: string; category: string; name: string; unitCost: number; basePrice: number }> = [
    { skuCode: "HT-13", category: "TRASH_BAGS", name: "Hefty Trash 13 gal 40 ct", unitCost: 3.1, basePrice: 6.49 },
    { skuCode: "HT-45", category: "TRASH_BAGS", name: "Hefty Trash 45 ct", unitCost: 4.2, basePrice: 8.99 },
    { skuCode: "HT-60", category: "TRASH_BAGS", name: "Hefty Trash 60 ct", unitCost: 5.5, basePrice: 11.49 },
    { skuCode: "HT-CINCH30", category: "TRASH_BAGS", name: "Hefty Cinch Sack 30 gal", unitCost: 3.8, basePrice: 7.99 },
    { skuCode: "HT-CINCH45", category: "TRASH_BAGS", name: "Hefty Cinch Sack 45 ct", unitCost: 4.9, basePrice: 9.99 },
    { skuCode: "HT-STRONG50", category: "TRASH_BAGS", name: "Hefty Strong 50 ct", unitCost: 5.2, basePrice: 10.99 },
    { skuCode: "HT-SCENT20", category: "TRASH_BAGS", name: "Hefty Scented 20 ct", unitCost: 2.8, basePrice: 5.99 },
    { skuCode: "HT-8GAL24", category: "TRASH_BAGS", name: "Hefty 8 gal 24 ct", unitCost: 2.4, basePrice: 5.49 },
    { skuCode: "HT-4GAL20", category: "TRASH_BAGS", name: "Hefty 4 gal 20 ct", unitCost: 1.9, basePrice: 4.29 },
    { skuCode: "HT-33GAL20", category: "TRASH_BAGS", name: "Hefty 33 gal 20 ct", unitCost: 6.2, basePrice: 14.99 },
    { skuCode: "HZ-QT", category: "FOOD_STORAGE_BAGS", name: "Hefty Slider Quart Bags", unitCost: 2.6, basePrice: 5.49 },
    { skuCode: "HZ-GAL", category: "FOOD_STORAGE_BAGS", name: "Hefty Slider Gallon Bags", unitCost: 3.2, basePrice: 6.99 },
    { skuCode: "HZ-SAND", category: "FOOD_STORAGE_BAGS", name: "Hefty Sandwich Bags", unitCost: 2.2, basePrice: 4.49 },
    { skuCode: "HZ-SNACK", category: "FOOD_STORAGE_BAGS", name: "Hefty Snack Bags", unitCost: 1.8, basePrice: 3.99 },
    { skuCode: "HZ-FREEZER", category: "FREEZER_BAGS", name: "Hefty Freezer Bags Quart", unitCost: 2.9, basePrice: 5.99 },
    { skuCode: "HZ-VAC-QT", category: "FOOD_STORAGE_BAGS", name: "Hefty Vacuum Quart", unitCost: 3.0, basePrice: 6.49 },
    { skuCode: "HZ-VAC-GAL", category: "FOOD_STORAGE_BAGS", name: "Hefty Vacuum Gallon", unitCost: 3.8, basePrice: 7.99 },
    { skuCode: "HZ-JUMBO", category: "FOOD_STORAGE_BAGS", name: "Hefty Jumbo Bags", unitCost: 2.5, basePrice: 5.29 },
    { skuCode: "HZ-FREEZER-GAL", category: "FREEZER_BAGS", name: "Hefty Freezer Bags Gallon", unitCost: 3.4, basePrice: 6.99 },
    { skuCode: "HZ-MULTI50", category: "FOOD_STORAGE_BAGS", name: "Hefty Multi-Pack 50 ct", unitCost: 4.1, basePrice: 8.99 },
    { skuCode: "HT-13-80", category: "TRASH_BAGS", name: "Hefty 13 gal 80 ct", unitCost: 7.0, basePrice: 16.99 },
    { skuCode: "HZ-STorage30", category: "FOOD_STORAGE_BAGS", name: "Hefty Storage 30 ct", unitCost: 2.0, basePrice: 4.29 },
  ];

  const tableware: Array<{ skuCode: string; category: string; name: string; unitCost: number; basePrice: number }> = [
    { skuCode: "HF-PLATE9", category: "PLATES", name: "Hefty Party Plates 9 in 20 ct", unitCost: 1.5, basePrice: 3.99 },
    { skuCode: "HF-PLATE10", category: "PLATES", name: "Hefty Party Plates 10 in 16 ct", unitCost: 1.8, basePrice: 4.49 },
    { skuCode: "HF-CUP9", category: "CUPS", name: "Hefty Party Cups 9 oz 20 ct", unitCost: 1.2, basePrice: 2.99 },
    { skuCode: "HF-CUP16", category: "CUPS", name: "Hefty Party Cups 16 oz 16 ct", unitCost: 1.5, basePrice: 3.79 },
    { skuCode: "HF-CUP18", category: "CUPS", name: "Hefty Party Cups 18 oz 12 ct", unitCost: 1.4, basePrice: 3.49 },
    { skuCode: "HF-CUTLERY24", category: "CUTLERY", name: "Hefty Cutlery 24 ct", unitCost: 2.2, basePrice: 5.49 },
    { skuCode: "HF-CUTLERY48", category: "CUTLERY", name: "Hefty Cutlery 48 ct", unitCost: 3.5, basePrice: 7.99 },
    { skuCode: "HF-BOWL8", category: "PLATES", name: "Hefty Bowls 8 oz 20 ct", unitCost: 1.6, basePrice: 4.29 },
    { skuCode: "HF-PLATE7", category: "PLATES", name: "Hefty Dessert Plates 7 in 24 ct", unitCost: 1.3, basePrice: 3.29 },
    { skuCode: "HF-NAPKIN50", category: "CUPS", name: "Hefty Napkins 50 ct", unitCost: 1.1, basePrice: 2.99 },
  ];

  const prestoValue: Array<{ skuCode: string; category: string; brand: string; name: string; unitCost: number; basePrice: number }> = [
    { skuCode: "PV-SB50", category: "STORAGE_BAGS", brand: "Presto", name: "Presto Storage Bags 50 ct", unitCost: 1.2, basePrice: 2.99 },
    { skuCode: "PV-SB100", category: "STORAGE_BAGS", brand: "Presto", name: "Presto Storage Bags 100 ct", unitCost: 2.0, basePrice: 4.49 },
    { skuCode: "PV-WB20", category: "WASTE_BAGS", brand: "Presto", name: "Presto Waste Bags 20 ct", unitCost: 1.5, basePrice: 3.49 },
    { skuCode: "PV-WB40", category: "WASTE_BAGS", brand: "Presto", name: "Presto Waste Bags 40 ct", unitCost: 2.5, basePrice: 5.99 },
    { skuCode: "PV-FW60", category: "FOOD_WRAP", brand: "Presto", name: "Presto Food Wrap 60 sq ft", unitCost: 1.0, basePrice: 2.49 },
    { skuCode: "PV-FW120", category: "FOOD_WRAP", brand: "Presto", name: "Presto Food Wrap 120 sq ft", unitCost: 1.8, basePrice: 4.29 },
    { skuCode: "SB-SB40", category: "STORAGE_BAGS", brand: "StoreBrand", name: "Store Brand Storage 40 ct", unitCost: 1.1, basePrice: 2.79 },
    { skuCode: "SB-WB15", category: "WASTE_BAGS", brand: "StoreBrand", name: "Store Brand Waste 15 ct", unitCost: 1.4, basePrice: 3.29 },
    { skuCode: "SB-FW90", category: "FOOD_WRAP", brand: "StoreBrand", name: "Store Brand Wrap 90 sq ft", unitCost: 1.2, basePrice: 2.99 },
    { skuCode: "PV-FREEZE25", category: "STORAGE_BAGS", brand: "Presto", name: "Presto Freezer Bags 25 ct", unitCost: 1.6, basePrice: 3.79 },
  ];

  const skuPayloads: Array<{ skuCode: string; segment: string; name: string; category: string; brand: string; unitCost: number; basePrice: number }> = [
    ...cookingBaking.map((s) => ({ ...s, segment: "COOKING_BAKING" as const, brand: "Reynolds" })),
    ...wasteStorage.map((s) => ({ ...s, segment: "WASTE_STORAGE" as const, brand: "Hefty" })),
    ...tableware.map((s) => ({ ...s, segment: "TABLEWARE" as const, brand: "Hefty" })),
    ...prestoValue.map((s) => ({ skuCode: s.skuCode, segment: "PRESTO_VALUE" as const, name: s.name, category: s.category, brand: s.brand, unitCost: s.unitCost, basePrice: s.basePrice })),
  ];

  for (const s of skuPayloads) {
    await prisma.sKU.upsert({
      where: { skuCode: s.skuCode },
      update: { segment: s.segment, name: s.name, category: s.category, brand: s.brand, unitCost: s.unitCost, basePrice: s.basePrice },
      create: s,
    });
  }

  const skuRows = await prisma.sKU.findMany({ orderBy: { skuCode: "asc" } });
  if (skuRows.length < 60) throw new Error(`Expected at least 60 SKUs, got ${skuRows.length}`);

  // ─── Budgets (create only if none exist) ───
  const quarters = ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"];
  const spendRanges: Record<string, [number, number]> = {
    Walmart: [4_000_000, 12_000_000],
    Kroger: [2_000_000, 6_000_000],
    Target: [2_500_000, 7_000_000],
    "Sam's Club": [1_500_000, 5_000_000],
    Costco: [1_500_000, 5_000_000],
    Albertsons: [1_200_000, 4_000_000],
    Walgreens: [800_000, 2_500_000],
    "Dollar General": [600_000, 2_000_000],
    Amazon: [3_000_000, 9_000_000],
    Aldi: [500_000, 1_800_000],
  };
  const existingBudgets = await prisma.budget.count();
  if (existingBudgets === 0) {
    for (const retailer of retailerRows) {
      const range = spendRanges[retailer.name] ?? [500_000, 2_000_000];
      const [min, max] = range;
      for (const period of quarters) {
        await prisma.budget.create({
          data: { retailerId: retailer.id, period, spend: Math.round(min + rng() * (max - min)) },
        });
      }
    }
  }

  // ─── Clean existing scenario-linked data ───
  await prisma.promoEvent.deleteMany({});
  await prisma.scenario.deleteMany({});

  const year = 2026;
  const weeks = 12;
  const q2StartWeek = 13;
  function weekToDate(weekIndex: number): Date {
    const d = new Date(year, 0, 1);
    d.setDate(d.getDate() + weekIndex * 7);
    return d;
  }
  function q2WeekToDate(weekOffset: number): Date {
    return weekToDate(q2StartWeek + weekOffset);
  }

  const promoTypes = ["TPR", "BOGO", "Display", "Feature", "Seasonal", "Clearance"] as const;
  const aldi = retailerRows.find((r) => r.name === "Aldi")!;

  function pick25Skus(): typeof skuRows {
    const shuffled = [...skuRows].sort(() => rng() - 0.5);
    return shuffled.slice(0, 25);
  }

  function seedScenarioPromoEvents(
    scenarioId: string,
    scenarioSkus: typeof skuRows,
    opts: { cookingBakingSeasonalWeeks?: number[]; tablewareDisplayWeeks?: number[]; lowInventoryPct?: number }
  ) {
    const { cookingBakingSeasonalWeeks = [4, 5, 6], tablewareDisplayWeeks = [7, 8, 9], lowInventoryPct = 0.1 } = opts;
    const events: Parameters<typeof prisma.promoEvent.create>[0]["data"][] = [];
    for (let w = 0; w < weeks; w++) {
      for (const sku of scenarioSkus) {
        const segment = (sku as { segment?: string }).segment ?? "COOKING_BAKING";
        const category = sku.category;
        let mechanic: (typeof promoTypes)[number];
        if (segment === "COOKING_BAKING" && cookingBakingSeasonalWeeks.includes(w)) {
          mechanic = pick(rng, ["Seasonal", "TPR", "Display"] as const);
        } else if (segment === "TABLEWARE" && tablewareDisplayWeeks.includes(w)) {
          mechanic = pick(rng, ["Display", "Feature", "TPR"] as const);
        } else if (segment === "WASTE_STORAGE" || category === "TRASH_BAGS" || category === "FOOD_STORAGE_BAGS" || category === "FREEZER_BAGS") {
          mechanic = pick(rng, ["TPR", "BOGO", "Display"] as const);
        } else {
          mechanic = pick(rng, [...promoTypes]);
        }
        const periodStart = q2WeekToDate(w);
        const periodEnd = q2WeekToDate(w + 1);
        const discountDepth =
          mechanic === "TPR" ? pick(rng, [0.1, 0.15, 0.2, 0.25]) : mechanic === "BOGO" ? 0.5 : mechanic === "Clearance" ? pick(rng, [0.3, 0.4, 0.5]) : pick(rng, [0.1, 0.15, 0.2]);
        const baselineUnits = randInt(rng, 5000, 22000);
        const lift = mechanic === "Display" || mechanic === "Feature" ? randInt(rng, 15, 40) / 100 : mechanic === "BOGO" ? randInt(rng, 80, 150) / 100 : randInt(rng, 25, 60) / 100;
        const promoUnits = Math.round(baselineUnits * (1 + lift));
        const inventoryFlag = rng() < lowInventoryPct ? "LOW" : "OK";
        events.push({
          retailerId: aldi.id,
          skuId: sku.id,
          scenarioId,
          periodStart,
          periodEnd,
          discountDepth,
          durationWeeks: 1,
          baselineUnits,
          promoUnits,
          inventoryFlag,
          promoType: mechanic,
          displaySupport: mechanic === "Display" || mechanic === "Feature",
          featureAd: mechanic === "Feature",
        });
      }
    }
    return events;
  }

  // 1) Baseline Plan (DRAFT)
  const baseline = await prisma.scenario.create({
    data: {
      name: "Baseline Plan",
      status: "DRAFT",
      objectiveJson: { period: "2026-Q2", objectiveType: "balanced", constraints: { roiMin: 1.2, spendCap: 3_000_000, stockoutMax: 0.15 } },
      kpiSummary: { revenue: 9_500_000, volume: 1_200_000, spend: 2_100_000, margin: 2_800_000, roi: 1.33, risk: 0.12 },
    },
  });
  const baselineSkus = pick25Skus();
  const baselineEvents = seedScenarioPromoEvents(baseline.id, baselineSkus, { lowInventoryPct: 0.1 });
  for (const e of baselineEvents) await prisma.promoEvent.create({ data: e });

  // 2) Agent – Max Margin
  const agentMargin = await prisma.scenario.create({
    data: {
      name: "Agent Plan – Max Margin",
      status: "AGENT_GENERATED",
      objectiveJson: { period: "2026-Q2", objectiveType: "maximize_margin", constraints: { roiMin: 1.25, spendCap: 2_800_000, stockoutMax: 0.12 } },
      kpiSummary: { revenue: 10_200_000, volume: 1_280_000, spend: 2_300_000, margin: 3_100_000, roi: 1.35, risk: 0.14 },
    },
  });
  const marginSkus = pick25Skus();
  const marginEvents = seedScenarioPromoEvents(agentMargin.id, marginSkus, { lowInventoryPct: 0.08 });
  for (const e of marginEvents) await prisma.promoEvent.create({ data: e });

  // 3) Agent – Share Defense
  const agentShare = await prisma.scenario.create({
    data: {
      name: "Agent Plan – Share Defense",
      status: "AGENT_GENERATED",
      objectiveJson: { period: "2026-Q2", objectiveType: "share_defense", constraints: { roiMin: 1.15, spendCap: 3_200_000, stockoutMax: 0.18 } },
      kpiSummary: { revenue: 10_800_000, volume: 1_350_000, spend: 2_600_000, margin: 2_900_000, roi: 1.22, risk: 0.16 },
    },
  });
  const shareSkus = pick25Skus();
  const shareEvents = seedScenarioPromoEvents(agentShare.id, shareSkus, { lowInventoryPct: 0.12 });
  for (const e of shareEvents) await prisma.promoEvent.create({ data: e });

  // 4) Agent – Inventory Safe
  const agentInventory = await prisma.scenario.create({
    data: {
      name: "Agent Plan – Inventory Safe",
      status: "AGENT_GENERATED",
      objectiveJson: { period: "2026-Q2", objectiveType: "inventory_safe", constraints: { roiMin: 1.2, spendCap: 2_500_000, stockoutMax: 0.08 } },
      kpiSummary: { revenue: 9_800_000, volume: 1_220_000, spend: 2_000_000, margin: 2_950_000, roi: 1.38, risk: 0.07 },
    },
  });
  const invSkus = pick25Skus();
  const invEvents = seedScenarioPromoEvents(agentInventory.id, invSkus, { lowInventoryPct: 0.05 });
  for (const e of invEvents) await prisma.promoEvent.create({ data: e });

  // ─── SignalTick (12–20 rows) ───
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const signalPayloads = [
    { type: "competitor_drop", payload: JSON.stringify({ competitorIndexDeltaPct: -0.08, category: "Trash Bags", weeks: [6, 7] }) },
    { type: "inventory_delay", payload: JSON.stringify({ skuCode: "HT-13", delayWeeks: 2 }) },
    { type: "demand_spike", payload: JSON.stringify({ category: "Foil", deltaPct: 0.15, weeks: [5, 6] }) },
    { type: "competitor_drop", payload: JSON.stringify({ competitorIndexDeltaPct: -0.05, category: "Food Storage", weeks: [8, 9] }) },
    { type: "demand_spike", payload: JSON.stringify({ category: "PARCHMENT", deltaPct: 0.12, weeks: [4, 5] }) },
    { type: "inventory_delay", payload: JSON.stringify({ skuCode: "RW-75", delayWeeks: 1 }) },
    { type: "competitor_drop", payload: JSON.stringify({ competitorIndexDeltaPct: -0.03, category: "Tableware", weeks: [10, 11] }) },
    { type: "demand_spike", payload: JSON.stringify({ category: "TRASH_BAGS", deltaPct: 0.08, weeks: [7, 8] }) },
    { type: "inventory_delay", payload: JSON.stringify({ skuCode: "HZ-GAL", delayWeeks: 2 }) },
    { type: "demand_spike", payload: JSON.stringify({ category: "FOIL", deltaPct: 0.2, weeks: [3, 4] }) },
    { type: "competitor_drop", payload: JSON.stringify({ competitorIndexDeltaPct: -0.1, category: "Foil", weeks: [5, 6, 7] }) },
    { type: "inventory_delay", payload: JSON.stringify({ skuCode: "HT-45", delayWeeks: 1 }) },
    { type: "demand_spike", payload: JSON.stringify({ category: "PLASTIC_WRAP", deltaPct: 0.1, weeks: [6] }) },
    { type: "competitor_drop", payload: JSON.stringify({ competitorIndexDeltaPct: -0.06, category: "Parchment", weeks: [4, 5] }) },
    { type: "inventory_delay", payload: JSON.stringify({ skuCode: "RW-PC60", delayWeeks: 3 }) },
  ];
  for (let i = 0; i < 15; i++) {
    const { type, payload } = signalPayloads[i % signalPayloads.length]!;
    const createdAt = new Date(twoDaysAgo.getTime() + rng() * 2 * 24 * 60 * 60 * 1000);
    await prisma.signalTick.create({
      data: { type, payload, createdAt },
    });
  }

  console.log("Seed complete: 10 retailers, 60 SKUs, 4 scenarios (300 PromoEvents each), SignalTicks.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
