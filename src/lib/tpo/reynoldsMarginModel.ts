/**
 * Reynolds TPO Margin Model
 * Aligns with SEC filings: 4–6% trade spend, Walmart EDLP, realistic CPG lift curves
 */

export type PromoType =
  | "None"
  | "All Price Off"
  | "Display"
  | "Feature"
  | "BOGO"
  | "Seasonal";

/** Lift multipliers by discount % (CPG realistic) */
const LIFT_BY_DISCOUNT: Record<number, number> = {
  0: 1.0,
  0.05: 1.08,
  0.1: 1.15,
  0.15: 1.25,
  0.2: 1.4,
};

/** Display adds +20% incremental lift */
const DISPLAY_MULTIPLIER = 1.2;

/** Feature ad adds +15% incremental lift */
const FEATURE_MULTIPLIER = 1.15;

/** BOGO lift range */
const BOGO_LIFT_MIN = 1.8;
const BOGO_LIFT_MAX = 2.2;

/** Seasonal limited: high lift, typically 1.5–2.0x */
const SEASONAL_LIFT = 1.75;

/** Get base lift from discount depth (interpolate between known points) */
export function getLiftByDiscount(discountPct: number): number {
  const keys = Object.keys(LIFT_BY_DISCOUNT)
    .map(Number)
    .sort((a, b) => a - b);
  const d = Math.max(0, Math.min(0.2, discountPct));
  let lo = keys[0];
  let hi = keys[keys.length - 1];
  for (const k of keys) {
    if (k <= d) lo = k;
    if (k >= d) {
      hi = k;
      break;
    }
  }
  if (lo === hi) return LIFT_BY_DISCOUNT[lo];
  const t = (d - lo) / (hi - lo);
  return LIFT_BY_DISCOUNT[lo] * (1 - t) + LIFT_BY_DISCOUNT[hi] * t;
}

/** Compute promo unit lift: base_lift * display * feature (multiplicative) */
export function computeLift(
  promoType: PromoType,
  discountPct: number,
  displaySupport: boolean,
  featureAd: boolean,
  rng?: () => number
): number {
  let baseLift = 1.0;
  if (promoType === "None" || (promoType === "All Price Off" && discountPct === 0)) {
    baseLift = 1.0;
  } else if (promoType === "BOGO") {
    const t = rng ? rng() : 0.5;
    baseLift = BOGO_LIFT_MIN + t * (BOGO_LIFT_MAX - BOGO_LIFT_MIN);
  } else if (promoType === "Seasonal") {
    baseLift = SEASONAL_LIFT;
  } else {
    baseLift = getLiftByDiscount(discountPct);
  }

  let lift = baseLift;
  if (displaySupport) lift *= DISPLAY_MULTIPLIER;
  if (featureAd) lift *= FEATURE_MULTIPLIER;
  return lift;
}

/** Promo net price */
export function promoPrice(basePrice: number, discountPct: number): number {
  return basePrice * (1 - discountPct);
}

/** Base margin % */
export function baseMarginPct(basePrice: number, baseCost: number): number {
  return basePrice > 0 ? (basePrice - baseCost) / basePrice : 0;
}

/** Promo units = base_units * lift */
export function promoUnits(baseUnits: number, lift: number): number {
  return Math.round(baseUnits * lift);
}

/** Trade spend (as $) = base_price * base_units * discount_pct for promoted units */
export function tradeSpend(
  basePrice: number,
  promoUnitsCount: number,
  discountPct: number
): number {
  return basePrice * promoUnitsCount * discountPct;
}

/** Total revenue (promo) = promo_price * promo_units */
export function promoRevenue(
  basePrice: number,
  discountPct: number,
  promoUnitsCount: number
): number {
  return promoPrice(basePrice, discountPct) * promoUnitsCount;
}

/** Promo margin = (promo_price - cost) * promo_units */
export function promoMargin(
  basePrice: number,
  baseCost: number,
  discountPct: number,
  promoUnitsCount: number
): number {
  const p = promoPrice(basePrice, discountPct);
  return (p - baseCost) * promoUnitsCount;
}

/** Base margin (no promo) = (base_price - cost) * base_units */
export function baseMargin(
  basePrice: number,
  baseCost: number,
  baseUnitsCount: number
): number {
  return (basePrice - baseCost) * baseUnitsCount;
}

/** Incremental margin = promo_margin - base_margin (for same period) */
export function incrementalMargin(
  promoMarginVal: number,
  baseMarginVal: number
): number {
  return promoMarginVal - baseMarginVal;
}

/** ROI = incremental_margin / trade_spend */
export function roi(incrementalMarginVal: number, tradeSpendVal: number): number {
  return tradeSpendVal > 0 ? incrementalMarginVal / tradeSpendVal : 0;
}

/** Trade spend as % of revenue: ensure 4–6% for Reynolds compliance */
export function tradeSpendPctOfRevenue(
  totalTradeSpend: number,
  totalRevenue: number
): number {
  return totalRevenue > 0 ? totalTradeSpend / totalRevenue : 0;
}

/** Reynolds compliance check: trade spend 4–6% */
export function isTradeSpendCompliant(tradeSpendPct: number): boolean {
  return tradeSpendPct >= 0.04 && tradeSpendPct <= 0.06;
}
