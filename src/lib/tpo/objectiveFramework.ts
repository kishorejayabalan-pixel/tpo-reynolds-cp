/**
 * TPO objective framework from the "Increase Volumes and Minimize TP Spend" flowchart.
 * Used by the agent and the Scenario Summary panel.
 */

export const PRIMARY_GOAL = "Increase volumes and minimize TP spend";

export const PRICE_LEVERS = [
  "List price increase",
  "Price folding",
  "NPD (New Product Development / Net Price Discount)",
] as const;

export const PROMOTION_LEVERS = [
  "Slotting",
  "Uplift",
  "Promotion calendar",
] as const;

/** Process steps the agent follows (from flowchart). */
export const AGENT_PROCESS_STEPS = [
  "Set objective: Increase volumes and minimize TP spend.",
  "Apply Price Guidelines and Promotion Guidelines (RRP, list price, promotion price).",
  "Price analysis: Start with Price Index, drill down to PPGs on price gaps; prioritize by elasticities and volume contribution; insights on price per gram.",
  "Promotion analysis: Analyze post-promo effectiveness; prioritize by promo depth, frequency, slotting; insights on promo calendar mechanics.",
  "Apply levers: Price (list price increase, price folding, NPD) and Promotion (slotting, uplift, calendar).",
  "Output: VOD and optimal depth → Volume impact.",
] as const;

export type PriceLever = (typeof PRICE_LEVERS)[number];
export type PromotionLever = (typeof PROMOTION_LEVERS)[number];

export interface TPOObjectivePayload {
  primaryGoal: string;
  objectiveType: string;
  period?: string;
  constraints?: Record<string, unknown>;
  levers: { price: string[]; promotion: string[] };
  agentSteps: string[];
  dataSource: "real" | "synthetic";
  /** Event input source; Exceedra integration uses synthetic data when live feed is unavailable. */
  eventSource?: "Exceedra";
  eventSourceMode?: "live" | "synthetic";
}

/** Build objectiveJson shape for a scenario so the summary panel can show objective, levers, steps, and data source. */
export function buildTPOObjectiveJson(opts: {
  objectiveType?: string;
  period?: string;
  constraints?: Record<string, unknown>;
  dataSource?: "real" | "synthetic";
  eventSource?: "Exceedra";
  eventSourceMode?: "live" | "synthetic";
}): TPOObjectivePayload {
  const {
    objectiveType = "increase_volume_minimize_tp_spend",
    period = "2026-Q2",
    constraints = {},
    dataSource = "real",
    eventSource = "Exceedra",
    eventSourceMode = "synthetic",
  } = opts;
  return {
    primaryGoal: PRIMARY_GOAL,
    objectiveType,
    period,
    constraints,
    levers: {
      price: [...PRICE_LEVERS],
      promotion: [...PROMOTION_LEVERS],
    },
    agentSteps: [...AGENT_PROCESS_STEPS],
    dataSource,
    eventSource,
    eventSourceMode,
  };
}

/** When real elasticity/post-promo data is missing, we use synthetic data. Returns placeholder metrics for prioritization. */
export function getSyntheticElasticityByCategory(category: string): number {
  const seed = category.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return 0.15 + (seed % 20) / 100; // 0.15–0.35
}

export function getSyntheticPostPromoLift(mechanic: string): number {
  const lifts: Record<string, number> = {
    TPR: 0.25,
    BOGO: 0.9,
    Display: 0.2,
    Feature: 0.35,
    Seasonal: 0.3,
    Clearance: 0.5,
  };
  return lifts[mechanic] ?? 0.2;
}
