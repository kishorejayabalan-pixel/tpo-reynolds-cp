/**
 * Reynolds / Hefty product display names for UI (SKU × Week calendar, SKU grid).
 * Maps skuCode → friendly product name. Fallback: "Brand · skuCode".
 */
const REYNOLDS_DISPLAY_NAMES: Record<string, string> = {
  // Reynolds Foil & Wrap
  "RW-75": "Reynolds Wrap 75 ft",
  "RW-200": "Reynolds Wrap 200 ft",
  "RW-125": "Reynolds Wrap 125 ft",
  "RW-HD75": "Reynolds Heavy Duty 75 ft",
  "RW-HD50": "Reynolds Heavy Duty 50 ft",
  "GF-60": "Reynolds Grill Foil 60 ft",
  "RW-PC30": "Reynolds Parchment 30 ft",
  "RW-PC60": "Reynolds Parchment 60 ft",
  RP: "Reynolds Parchment",
  RW75: "Reynolds Wrap 75 ft",
  RW200: "Reynolds Wrap 200 ft",
  // Hefty Trash Bags
  "HT-13": "Hefty Trash 13 gal",
  "HT-45": "Hefty Trash 45 ct",
  "HT-60": "Hefty Trash 60 ct",
  "HT-CINCH30": "Hefty Cinch Sack 30 gal",
  "HT-CINCH45": "Hefty Cinch Sack 45 ct",
  "HT-STRONG50": "Hefty Strong 50 ct",
  "HT-SCENT20": "Hefty Scented 20 ct",
  "HT-8GAL24": "Hefty 8 gal 24 ct",
  "HT-4GAL20": "Hefty 4 gal 20 ct",
  HT30: "Hefty Trash 30 ct",
  // Hefty Food Storage
  "HZ-QT": "Hefty Storage Quart",
  "HZ-GAL": "Hefty Storage Gallon",
  "HZ-SAND": "Hefty Sandwich Bags",
  "HZ-SNACK": "Hefty Snack Bags",
  "HZ-FREEZER": "Hefty Freezer Bags",
  "HZ-VAC-QT": "Hefty Vacuum Quart",
  "HZ-VAC-GAL": "Hefty Vacuum Gallon",
  "HZ-JUMBO": "Hefty Jumbo Bags",
  HSQt: "Hefty Storage Quart",
  HSG: "Hefty Slider Gallon",
  // Legacy / scripts seed
  SKU001: "Reynolds Food Wrap",
  SKU002: "Hefty Trash Bags",
  SKU003: "Reynolds Foil",
  SKU004: "Hefty Storage Bags",
  SKU005: "Reynolds Parchment Paper",
};

export function getSkuDisplayName(skuCode: string, brand?: string, name?: string): string {
  if (name != null && String(name).trim() !== "") return String(name).trim();
  const mapped = REYNOLDS_DISPLAY_NAMES[skuCode];
  if (mapped) return mapped;
  if (brand) return `${brand} · ${skuCode}`;
  return skuCode;
}
