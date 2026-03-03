import { prisma } from "./client";

const CATEGORIES = ["Foil", "Trash Bags", "Food Storage"] as const;
const MECHANICS = ["TPR", "BOGO", "Display", "Feature"] as const;

function dateFromWeek(weekNum: number): Date {
  const jan1 = new Date(2025, 0, 1);
  const start = new Date(jan1);
  start.setDate(jan1.getDate() + (weekNum - 1) * 7);
  return start;
}

function weekEndDate(startDate: Date): Date {
  const end = new Date(startDate);
  end.setDate(end.getDate() + 6);
  return end;
}

async function main() {
  console.log("Seeding TPO/TPM demo database...");

  await prisma.$transaction(async (tx) => {
    // Clear existing data (order matters for FKs)
    await tx.decisionLog.deleteMany();
    await tx.objective.deleteMany();
    await tx.competitorSignal.deleteMany();
    await tx.inventory_Weekly.deleteMany();
    await tx.pOS_Weekly.deleteMany();
    await tx.promoLine.deleteMany();
    await tx.promotion.deleteMany();
    await tx.calendar.deleteMany();
    await tx.store.deleteMany();
    await tx.retailer.deleteMany();
    await tx.product.deleteMany();

    // Products (30)
    const productData = [
      ...Array.from({ length: 10 }, (_, i) => ({
        sku: `FOIL-${1000 + i}`,
        brand: "Reynolds",
        category: "Foil",
        basePrice: 4.99 + i * 0.5,
        baseCost: 2.2 + i * 0.2,
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        sku: `TB-${2000 + i}`,
        brand: "Hefty",
        category: "Trash Bags",
        basePrice: 8.99 + i * 0.8,
        baseCost: 3.5 + i * 0.3,
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        sku: `FS-${3000 + i}`,
        brand: "Reynolds",
        category: "Food Storage",
        basePrice: 5.99 + i * 0.4,
        baseCost: 2.8 + i * 0.15,
      })),
    ];
    const products = await Promise.all(
      productData.map((p) => tx.product.create({ data: p }))
    );
    const productByCat = (cat: string) =>
      products.filter((p) => p.category === cat);
    const foil = productByCat("Foil");
    const trash = productByCat("Trash Bags");
    const food = productByCat("Food Storage");

    // Retailers (3)
    const retailerA = await tx.retailer.create({
      data: { name: "Retailer A", region: "US", channel: "Mass" },
    });
    const retailerB = await tx.retailer.create({
      data: { name: "Retailer B", region: "US", channel: "Grocery" },
    });
    const club = await tx.retailer.create({
      data: { name: "Club", region: "US", channel: "Club" },
    });
    const retailers = [retailerA, retailerB, club];

    // Stores (50)
    const storeData = [
      ...Array.from({ length: 20 }, () => ({
        retailerId: retailerA.id,
        storeType: "Standard",
      })),
      ...Array.from({ length: 20 }, () => ({
        retailerId: retailerB.id,
        storeType: "Standard",
      })),
      ...Array.from({ length: 10 }, () => ({
        retailerId: club.id,
        storeType: "Club",
      })),
    ];
    await tx.store.createMany({ data: storeData });

    // Calendar (26 weeks)
    for (let w = 1; w <= 26; w++) {
      const start = dateFromWeek(w);
      await tx.calendar.create({
        data: {
          weekId: w,
          startDate: start,
          endDate: weekEndDate(start),
        },
      });
    }

    // Promotions (100+)
    const promotions: { retailerId: string; startWeek: number; endWeek: number; mechanicType: string; discount: number; expectedFunding: number }[] = [];
    for (const r of retailers) {
      for (let w = 1; w <= 22; w += 2) {
        promotions.push({
          retailerId: r.id,
          startWeek: w,
          endWeek: w + 1,
          mechanicType: MECHANICS[w % MECHANICS.length],
          discount: 10 + (w % 5) * 5,
          expectedFunding: 5000 + Math.floor(Math.random() * 15000),
        });
      }
    }
    const createdPromos = await Promise.all(
      promotions.map((p) => tx.promotion.create({ data: { ...p, status: "DRAFT" } }))
    );

    // PromoLines (attach products to promos)
    for (let i = 0; i < createdPromos.length; i++) {
      const promo = createdPromos[i];
      const cat = [foil, trash, food][i % 3];
      const skus = cat.slice(0, 3);
      for (const sku of skus) {
        await tx.promoLine.create({
          data: {
            promotionId: promo.id,
            productId: sku.id,
            forecastUnits: 500 + Math.floor(Math.random() * 2000),
            expectedLift: 1.2 + Math.random() * 0.8,
            expectedRoi: 1.1 + Math.random() * 0.9,
          },
        });
      }
    }

    // POS_Weekly baseline (26 weeks × retailers × sample products)
    const posData: { week: number; retailerId: string; productId: string; units: number; revenue: number }[] = [];
    for (let w = 1; w <= 26; w++) {
      for (const r of retailers) {
        for (const p of products.slice(0, 15)) {
          const baseUnits = 200 + Math.floor(Math.random() * 800);
          const price = p.basePrice * (0.9 + Math.random() * 0.2);
          posData.push({
            week: w,
            retailerId: r.id,
            productId: p.id,
            units: baseUnits,
            revenue: baseUnits * price,
          });
        }
      }
    }
    await tx.pOS_Weekly.createMany({ data: posData });

    // Inventory_Weekly baseline
    const invData: { week: number; retailerId: string; productId: string; onHand: number; inbound: number }[] = [];
    for (let w = 1; w <= 26; w++) {
      for (const r of retailers) {
        for (const p of products.slice(0, 15)) {
          invData.push({
            week: w,
            retailerId: r.id,
            productId: p.id,
            onHand: 1000 + Math.floor(Math.random() * 5000),
            inbound: w <= 24 ? 500 + Math.floor(Math.random() * 2000) : 0,
          });
        }
      }
    }
    await tx.inventory_Weekly.createMany({ data: invData });

    // CompetitorSignal (with occasional shocks)
    const compData: { week: number; retailerId: string; category: string; competitorIndexPrice: number; promoIntensity: number }[] = [];
    for (let w = 1; w <= 26; w++) {
      for (const r of retailers) {
        for (const cat of CATEGORIES) {
          let idx = 100;
          if (cat === "Trash Bags" && w === 10 && r.id === retailerA.id) idx = 92;
          else if (cat === "Foil" && w >= 7 && w <= 9) idx = 95;
          else idx = 98 + Math.floor(Math.random() * 6);
          compData.push({
            week: w,
            retailerId: r.id,
            category: cat,
            competitorIndexPrice: idx,
            promoIntensity: 0.2 + Math.random() * 0.5,
          });
        }
      }
    }
    await tx.competitorSignal.createMany({ data: compData });
  });

  console.log("Seed complete: 30 products, 3 retailers, 50 stores, 26 weeks, 100+ promotions, POS/inv/comp signals");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
