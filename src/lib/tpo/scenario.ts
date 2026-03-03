/**
 * Scenario generator: create N scenarios by shifting spend across retailers under constraints
 */

export interface BudgetEntry {
  retailerId: string;
  retailerName: string;
  spend: number;
}

export interface TPOConstraints {
  minSpendByRetailer?: Record<string, number>;
  maxSpendByRetailer?: Record<string, number>;
  maxShiftPct?: number; // max % shift from base per retailer
  excludeRetailers?: string[];
  preferRetailers?: string[];
  maxDiscountDepth?: number;
}

export interface Scenario {
  allocation: Record<string, number>; // retailerName -> spend
  incMargin: number;
  revenue: number;
  roi: number;
  balancedScore: number; // composite for balanced objective
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function generateScenarios(
  baseBudgets: BudgetEntry[],
  responseCurve: Record<string, number>, // retailerName -> margin per $ spend
  n: number,
  constraints: TPOConstraints = {}
): Scenario[] {
  const totalSpend = baseBudgets.reduce((s, b) => s + b.spend, 0);
  const baseByName = Object.fromEntries(baseBudgets.map((b) => [b.retailerName, b.spend]));
  const retailers = baseBudgets.map((b) => b.retailerName);
  const excluded = new Set(constraints.excludeRetailers ?? []);
  const maxShift = constraints.maxShiftPct ?? 0.3;
  const minSpend = constraints.minSpendByRetailer ?? {};
  const maxSpend = constraints.maxSpendByRetailer ?? {};

  const scenarios: Scenario[] = [];
  for (let i = 0; i < n; i++) {
    const allocation: Record<string, number> = {};

    for (const r of retailers) {
      if (excluded.has(r)) {
        allocation[r] = baseByName[r];
        continue;
      }
      const base = baseByName[r];
      const shift = (rand(-1, 1) * maxShift * base);
      allocation[r] = Math.max(0, base + shift);
    }

    const sum = Object.values(allocation).reduce((a, b) => a + b, 0);
    const scale = totalSpend / sum;
    for (const r of retailers) {
      allocation[r] = Math.round(allocation[r] * scale);
    }

    for (const r of retailers) {
      const mn = minSpend[r];
      const mx = maxSpend[r];
      if (mn != null && allocation[r] < mn) allocation[r] = mn;
      if (mx != null && allocation[r] > mx) allocation[r] = mx;
    }

    const rebalanced = rebalance(Object.entries(allocation).map(([k, v]) => ({ retailer: k, spend: v })), totalSpend, minSpend);
    const alloc = Object.fromEntries(rebalanced.map((x) => [x.retailer, x.spend]));

    let incMargin = 0;
    let revenue = 0;
    for (const r of retailers) {
      const resp = responseCurve[r] ?? 0.15;
      incMargin += alloc[r] * resp;
      revenue += alloc[r] * 1.2;
    }
    const roi = incMargin / totalSpend;
    const balancedScore = incMargin * 0.5 + revenue * 0.0001 + roi * 1000;

    scenarios.push({
      allocation: alloc,
      incMargin,
      revenue,
      roi,
      balancedScore,
    });
  }

  return scenarios;
}

function rebalance(
  entries: { retailer: string; spend: number }[],
  total: number,
  minSpend: Record<string, number>
): { retailer: string; spend: number }[] {
  const fixed = entries.filter((e) => (minSpend[e.retailer] ?? 0) > 0);
  const fixedTotal = fixed.reduce((s, e) => s + e.spend, 0);
  const flex = entries.filter((e) => !(minSpend[e.retailer] ?? 0));
  const remaining = total - fixedTotal;
  if (flex.length === 0) return entries;
  const perFlex = remaining / flex.length;
  return [
    ...fixed,
    ...flex.map((e) => ({ retailer: e.retailer, spend: Math.round(perFlex) })),
  ];
}
