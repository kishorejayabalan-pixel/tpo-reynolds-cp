/**
 * Seed Product, Baseline, Objective, and sample DRAFT promotions
 * Run after initial seed to populate agentic TPO models
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PRODUCTS = [
  { name: "Reynolds Wrap 75ft", brand: "Reynolds", category: "Foil", baseCost: 2.1, basePrice: 5.49 },
  { name: "Reynolds Wrap 200ft", brand: "Reynolds", category: "Foil", baseCost: 4.2, basePrice: 9.99 },
  { name: "Hefty Trash 30ct", brand: "Hefty", category: "Trash Bags", baseCost: 3.4, basePrice: 7.99 },
  { name: "Hefty Storage Qt", brand: "Hefty", category: "Storage", baseCost: 2.8, basePrice: 5.99 },
  { name: "Reynolds Parchment", brand: "Reynolds", category: "Tableware", baseCost: 1.9, basePrice: 4.49 },
  { name: "Hefty Slider Gallon", brand: "Hefty", category: "Storage", baseCost: 3.6, basePrice: 7.49 },
];

const PROMO_TYPE_MAP: Record<string, string> = {
  price_off: "ALL_PRICE_OFF",
  display: "DISPLAY",
  feature_ad: "FEATURE",
  bogo: "BOGO",
  pr_15: "PR_15",
  sell_dep: "SELL_DEP",
  price_off_2: "PRICE_OFF_2",
  clearance: "CLEARANCE",
};

async function main() {
  for (const p of PRODUCTS) {
    const existing = await prisma.product.findFirst({
      where: { name: p.name },
    });
    if (!existing) {
      await prisma.product.create({ data: p });
    }
  }

  const retailers = await prisma.retailer.findMany();
  const products = await prisma.product.findMany();
  const period = "2026-Q2";
  const weeksInPeriod = 13;

  await prisma.baseline.deleteMany({ where: { period } });
  for (const r of retailers.slice(0, 5)) {
    for (const p of products) {
      for (let w = 0; w < weeksInPeriod; w++) {
        const baseUnits = 500 + Math.floor(Math.random() * 1500);
        await prisma.baseline.create({
          data: {
            period,
            week: w,
            retailerId: r.id,
            productId: p.id,
            baseUnits,
            basePrice: p.basePrice,
            baseCost: p.baseCost,
          },
        });
      }
    }
  }

  const kroger = retailers.find((r) => r.name === "Kroger");
  if (kroger) {
    let obj = await prisma.objective.findFirst({
      where: { period, retailerId: kroger.id },
    });
    if (!obj) {
      obj = await prisma.objective.create({
        data: {
          period,
          retailerId: kroger.id,
          objectiveType: "MAX_MARGIN",
          maxDiscountPct: 0.2,
          tradeSpendPctMin: 0.04,
          tradeSpendPctMax: 0.06,
        },
      });
    }

    const samplePromos = [
      { productIdx: 0, promoType: "ALL_PRICE_OFF", startWeek: 0, durationWeeks: 4, discountPct: 0.1 },
      { productIdx: 1, promoType: "BOGO", startWeek: 4, durationWeeks: 2, discountPct: 0.15 },
      { productIdx: 2, promoType: "DISPLAY", startWeek: 2, durationWeeks: 3, discountPct: 0.05 },
    ];
    for (const sp of samplePromos) {
      const product = products[sp.productIdx];
      if (product) {
        await prisma.promotion.create({
          data: {
            period,
            retailerId: kroger.id,
            productId: product.id,
            promoType: sp.promoType,
            discountPct: sp.discountPct,
            displayFlag: sp.promoType === "DISPLAY",
            featureFlag: false,
            startWeek: sp.startWeek,
            durationWeeks: sp.durationWeeks,
            status: "DRAFT",
          },
        });
      }
    }
  }

  console.log("Agentic seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
