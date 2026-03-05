"use client";

import { useMemo } from "react";

export interface PromoCell {
  id: string;
  skuId: string;
  skuCode: string;
  category: string;
  weekIndex: number;
  mechanic: string;
  discountPct: number;
  expectedLift?: number;
  spend?: number;
  margin?: number;
  stockoutRisk?: number;
  roi?: number;
}

const MECHANIC_COLORS: Record<string, string> = {
  TPR: "bg-blue-500/80 text-white",
  BOGO: "bg-emerald-500/80 text-white",
  Feature: "bg-violet-500/80 text-white",
  Display: "bg-amber-500/80 text-white",
  "All Price Off": "bg-cyan-500/80 text-white",
  None: "bg-slate-700/80 text-slate-400",
};

const WEEKS = 12;

export default function ScenarioCalendar({
  skus,
  cellsBySkuWeek,
  onCellClick,
}: {
  skus: Array<{ id: string; skuCode: string; category: string; displayName?: string }>;
  cellsBySkuWeek: Map<string, PromoCell>;
  onCellClick?: (cell: PromoCell | null, weekIndex: number, sku: { id: string; skuCode: string }) => void;
}) {
  const grid = useMemo(() => {
    return skus.slice(0, 24).map((sku) => ({
      sku,
      weeks: Array.from({ length: WEEKS }, (_, w) => {
        const key = `${sku.id}-${w}`;
        const cell = cellsBySkuWeek.get(key);
        return cell ?? null;
      }),
    }));
  }, [skus, cellsBySkuWeek]);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/50">
        <h3 className="font-semibold text-slate-200">Scenario Calendar (SKU × Week)</h3>
      </div>
      <div className="overflow-auto max-h-[400px]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="sticky top-0 bg-slate-900/95 z-10">
              <th className="text-left py-2 px-3 text-slate-400 font-medium min-w-[11rem] w-48">Product</th>
              {Array.from({ length: WEEKS }, (_, i) => (
                <th key={i} className="w-14 py-2 text-center text-slate-500 font-normal">
                  W{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map(({ sku, weeks }) => (
              <tr key={sku.id} className="border-t border-slate-700/30">
                <td className="py-1.5 px-3 text-slate-300 font-medium sticky left-0 bg-slate-900/95 min-w-[11rem]">
                  {sku.displayName ?? sku.skuCode}
                </td>
                {weeks.map((cell, w) => {
                  const mechanic = cell?.mechanic ?? "None";
                  const color = MECHANIC_COLORS[mechanic] ?? MECHANIC_COLORS.None;
                  const riskHigh = (cell?.stockoutRisk ?? 0) > 0.2;
                  const roiLow = (cell?.roi ?? 1.5) < 1.25;
                  return (
                    <td key={w} className="w-14 py-1.5">
                      <button
                        type="button"
                        onClick={() => onCellClick?.(cell ?? null, w, sku)}
                        className={`
                          w-full min-h-[2rem] rounded border flex flex-col items-center justify-center py-0.5 px-0.5
                          ${color}
                          ${riskHigh ? "ring-1 ring-red-400" : ""}
                          ${roiLow && !riskHigh ? "ring-1 ring-amber-400" : ""}
                        `}
                        title={
                          cell
                            ? [
                                cell.mechanic,
                                `${(cell.discountPct * 100).toFixed(0)}% off`,
                                cell.expectedLift != null && `Lift: ${cell.expectedLift.toFixed(2)}x`,
                                cell.spend != null && `Spend: $${(cell.spend / 1000).toFixed(0)}K`,
                                cell.margin != null && `Margin: $${(cell.margin / 1000).toFixed(0)}K`,
                                cell.stockoutRisk != null && `Risk: ${(cell.stockoutRisk * 100).toFixed(0)}%`,
                                cell.roi != null && `ROI: ${cell.roi.toFixed(2)}`,
                              ]
                                .filter(Boolean)
                                .join(" · ")
                            : "Click to add promotion"
                        }
                      >
                        <span className="text-[10px] truncate max-w-full">
                          {cell ? (cell.discountPct * 100).toFixed(0) + "%" : "—"}
                        </span>
                        <span className="text-[9px] opacity-90 truncate max-w-full">
                          {cell?.mechanic ?? "—"}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
