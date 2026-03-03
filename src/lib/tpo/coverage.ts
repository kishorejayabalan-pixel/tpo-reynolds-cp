/**
 * Coverage checker: Circana gap logic + inventory risk
 * If circanaCoverage=false → lower confidence + "data gap note"
 */

export interface RetailerCoverage {
  retailerId: string;
  retailerName: string;
  circanaCoverage: boolean;
  inventoryRisk: "OK" | "LOW";
  confidence: "high" | "medium" | "low";
}

export interface CoverageResult {
  overallConfidence: "high" | "medium" | "low";
  retailerCoverage: RetailerCoverage[];
  dataGapNote: string | null;
}

export function assessCoverage(
  retailers: { id: string; name: string; circanaCoverage: boolean }[],
  inventoryFlags: Record<string, "OK" | "LOW">
): CoverageResult {
  const retailerCoverage: RetailerCoverage[] = retailers.map((r) => {
    const invFlag = inventoryFlags[r.id] ?? "OK";
    let confidence: "high" | "medium" | "low" = "high";

    if (!r.circanaCoverage) confidence = "low";
    else if (invFlag === "LOW") confidence = "medium";
    else confidence = "high";

    return {
      retailerId: r.id,
      retailerName: r.name,
      circanaCoverage: r.circanaCoverage,
      inventoryRisk: invFlag,
      confidence,
    };
  });

  const hasGaps = retailerCoverage.some((r) => !r.circanaCoverage);
  const lowConfRetailers = retailerCoverage.filter((r) => !r.circanaCoverage).map((r) => r.retailerName);
  const overallConfidence: "high" | "medium" | "low" = hasGaps
    ? lowConfRetailers.length >= 3
      ? "low"
      : "medium"
    : "high";

  const dataGapNote = hasGaps
    ? `Circana gap on ${lowConfRetailers.join(", ")} — limited panel data; estimates less reliable`
    : null;

  return {
    overallConfidence,
    retailerCoverage,
    dataGapNote,
  };
}
