/**
 * ML Lift Model — predict unit lift from promo params
 * Demo JS version; replace with Python microservice later
 */

export interface LiftInput {
  discountPct: number;
  promoType: string; // ALL_PRICE_OFF, BOGO, DISPLAY, FEATURE, etc.
  displayFlag: boolean;
  featureFlag: boolean;
}

export interface LiftOutput {
  lift: number; // multiplier (1.0 = no lift)
  confidence: number; // 0-1
}

export function predictLift(input: LiftInput): LiftOutput {
  let lift = 1.0;

  if (input.promoType === "ALL_PRICE_OFF") lift += input.discountPct * 2;
  else if (input.promoType === "BOGO") lift += 0.9;
  else if (input.promoType === "DISPLAY") lift += 0.4;
  else if (input.promoType === "FEATURE") lift += 0.3;
  else if (input.promoType === "PR_15") lift += 0.35;
  else if (input.promoType === "SELL_DEP") lift += 0.2;
  else if (input.promoType === "PRICE_OFF_2") lift += 0.5;
  else if (input.promoType === "CLEARANCE") lift += 0.6;

  if (input.displayFlag) lift += 0.15;
  if (input.featureFlag) lift += 0.1;

  const confidence = Math.max(0.3, 0.7 - input.discountPct * 0.5);

  return { lift, confidence };
}
