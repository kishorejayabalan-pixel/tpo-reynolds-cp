/**
 * Reynolds–Walmart Trade Promotion Deal Types
 * Based on industry research: Walmart allowances (AA, DA, EB, etc.),
 * CPG deal structures (Off-Invoice, Scan-Back, MCB), and in-store tactics.
 */

export interface DealType {
  id: string;
  label: string;
  shortCode?: string; // Walmart allowance code
  category: "price" | "display" | "allowance" | "scan" | "feature";
  typicalDiscountPct: number;
  description: string;
}

export const REYNOLDS_WALMART_DEAL_TYPES: DealType[] = [
  // Price-based (TPR, BOGO)
  { id: "all_price_off", label: "All Price Off", category: "price", typicalDiscountPct: 15, description: "Temporary price reduction on all units" },
  { id: "bogo", label: "BOGO Free", shortCode: "BOGO", category: "price", typicalDiscountPct: 50, description: "Buy one get one free" },
  { id: "tpr_10", label: "TPR 10%", category: "price", typicalDiscountPct: 10, description: "10% temporary price reduction" },
  { id: "tpr_15", label: "TPR 15%", category: "price", typicalDiscountPct: 15, description: "15% temporary price reduction" },
  { id: "tpr_20", label: "TPR 20%", category: "price", typicalDiscountPct: 20, description: "20% temporary price reduction" },
  // Walmart allowances
  { id: "aa", label: "Advertising Allowance", shortCode: "AA", category: "allowance", typicalDiscountPct: 5, description: "Defrays advertising costs, % of PO" },
  { id: "da", label: "Display/Encap Allowance", shortCode: "DA", category: "display", typicalDiscountPct: 8, description: "In-store display / end cap support" },
  { id: "eb", label: "Early Buy", shortCode: "EB", category: "allowance", typicalDiscountPct: 4, description: "Budgeting advantage for early purchase" },
  { id: "ha", label: "Handling Allowance", shortCode: "HA", category: "allowance", typicalDiscountPct: 2, description: "Business development / handling" },
  // CPG deal structures
  { id: "off_invoice", label: "Off-Invoice (OI)", category: "price", typicalDiscountPct: 12, description: "Discount at billing, no scan-back" },
  { id: "scan_back", label: "Scan-Back", category: "scan", typicalDiscountPct: 15, description: "Discount on units sold per scan data" },
  // In-store
  { id: "display", label: "Display", category: "display", typicalDiscountPct: 10, description: "Secondary display placement" },
  { id: "feature_ad", label: "Feature Ad", category: "feature", typicalDiscountPct: 12, description: "Featured in circular/ad" },
  { id: "end_cap", label: "End Cap", category: "display", typicalDiscountPct: 14, description: "End-of-aisle display" },
  { id: "clearance", label: "Clearance", category: "price", typicalDiscountPct: 30, description: "Seasonal or overstock clearance" },
];

/** Deal types suitable for the Planner Gantt */
export const PLANNER_DEAL_TYPES = [
  { id: "all_price_off", label: "All Price Off", color: "#22c55e" },
  { id: "display", label: "Display", color: "#f97316" },
  { id: "feature_ad", label: "Feature Ad", color: "#ef4444" },
  { id: "bogo", label: "BOGO Free", color: "#a855f7" },
  { id: "tpr_15", label: "TPR 15%", color: "#3b82f6" },
  { id: "end_cap", label: "End Cap", color: "#ec4899" },
  { id: "tpr_20", label: "TPR 20%", color: "#14b8a6" },
  { id: "off_invoice", label: "Off-Invoice", color: "#8b5cf6" },
  { id: "scan_back", label: "Scan-Back", color: "#06b6d4" },
  { id: "aa", label: "Ad Allowance", color: "#f59e0b" },
  { id: "da", label: "Display Allowance", color: "#10b981" },
  { id: "clearance", label: "Clearance", color: "#eab308" },
];
