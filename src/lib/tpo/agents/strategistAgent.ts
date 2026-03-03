/**
 * Strategist Agent — outputs ObjectiveSpec (weights + guardrails)
 */
export interface ObjectiveInput {
  objectiveType: string;
  maxDiscountPct: number;
  tradeSpendPctMin: number;
  tradeSpendPctMax: number;
}

export interface ObjectiveSpec {
  weights: {
    margin: number;
    roi: number;
    units: number;
  };
  guardrails: {
    maxDiscountPct: number;
    tradeSpendPctMin: number;
    tradeSpendPctMax: number;
    maxBOGOPerProduct: number;
    maxOverlappingWeeks: number;
    minWeeksBetweenSameProduct: number;
  };
  objectiveType: string;
}

export function runStrategistAgent(objective: ObjectiveInput): ObjectiveSpec {
  const { objectiveType, maxDiscountPct, tradeSpendPctMin, tradeSpendPctMax } = objective;

  let weights = { margin: 0.5, roi: 0.3, units: 0.2 };
  switch (objectiveType) {
    case "MAX_MARGIN":
      weights = { margin: 0.8, roi: 0.1, units: 0.1 };
      break;
    case "MAX_ROI":
      weights = { margin: 0.2, roi: 0.7, units: 0.1 };
      break;
    case "MAX_UNITS":
      weights = { margin: 0.2, roi: 0.1, units: 0.7 };
      break;
    case "BALANCED":
      weights = { margin: 0.4, roi: 0.4, units: 0.2 };
      break;
  }

  return {
    weights,
    guardrails: {
      maxDiscountPct: maxDiscountPct ?? 0.2,
      tradeSpendPctMin: tradeSpendPctMin ?? 0.04,
      tradeSpendPctMax: tradeSpendPctMax ?? 0.06,
      maxBOGOPerProduct: 2,
      maxOverlappingWeeks: 0,
      minWeeksBetweenSameProduct: 1,
    },
    objectiveType,
  };
}
