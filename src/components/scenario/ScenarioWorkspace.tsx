"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import ScenarioCalendar from "./ScenarioCalendar";
import AgentInsightPanel from "./AgentInsightPanel";
import AddPromoForm from "./AddPromoForm";
import EditCellPopover from "./EditCellPopover";
import type { AgentInsightData } from "./AgentInsightPanel";

export interface PromoEventRow {
  id: string;
  skuId: string;
  skuCode: string;
  skuDisplayName?: string;
  category: string;
  periodStart: string;
  periodEnd: string;
  discountDepth: number;
  durationWeeks: number;
  promoType: string | null;
  displaySupport: boolean | null;
  featureAd: boolean | null;
  baselineUnits: number;
  promoUnits: number;
  inventoryFlag: string;
  retailerName: string;
  agentReason?: string | null;
}

interface ScenarioWorkspaceProps {
  scenarioId: string | null;
  scenarioName: string;
  kpiSummary: Record<string, unknown> | null;
  promoEvents: PromoEventRow[];
  agentInsight: AgentInsightData | null;
  onRefresh?: () => void;
  onCellClick?: (cell: { skuCode: string; weekIndex: number; mechanic: string; discountPct: number }) => void;
}

const KPI_KEYS = [
  { key: "revenue", label: "Revenue", color: "text-cyan-400" },
  { key: "volume", label: "Volume", color: "text-slate-300" },
  { key: "spend", label: "Spend", color: "text-amber-400" },
  { key: "margin", label: "Margin", color: "text-emerald-400" },
  { key: "roi", label: "ROI", color: "text-indigo-400" },
  { key: "risk", label: "Risk", color: "text-red-400" },
];

export default function ScenarioWorkspace({
  scenarioId,
  scenarioName,
  kpiSummary,
  promoEvents,
  agentInsight,
  onRefresh,
  onCellClick,
}: ScenarioWorkspaceProps) {
  const [allSkus, setAllSkus] = useState<Array<{ id: string; skuCode: string; category: string; displayName?: string }>>([]);
  const [editingCell, setEditingCell] = useState<{
    eventId: string;
    skuCode: string;
    weekIndex: number;
    mechanic: string;
    discountPct: number;
    agentReason?: string | null;
    anchor: { x: number; y: number };
  } | null>(null);
  const [whyPopover, setWhyPopover] = useState<{ skuName: string; weekLabel: string; reason: string; x: number; y: number } | null>(null);
  const [addForSkuWeek, setAddForSkuWeek] = useState<{ skuId: string; skuCode: string; weekIndex: number } | null>(null);

  useEffect(() => {
    if (scenarioId) {
      fetch("/api/skus")
        .then((r) => r.json())
        .then((d) => d.skus && setAllSkus(d.skus.map((s: { id: string; skuCode: string; category: string; displayName?: string }) => ({ id: s.id, skuCode: s.skuCode, category: s.category, displayName: s.displayName }))));
    }
  }, [scenarioId]);

  const skus = useMemo(() => {
    const bySku = new Map<string, { id: string; skuCode: string; category: string; displayName?: string }>();
    for (const e of promoEvents) {
      if (!bySku.has(e.skuId)) {
        bySku.set(e.skuId, { id: e.skuId, skuCode: e.skuCode, category: e.category, displayName: e.skuDisplayName });
      }
    }
    return Array.from(bySku.values());
  }, [promoEvents]);

  const skusForGrid = useMemo(() => {
    if (skus.length > 0) return skus;
    return allSkus.slice(0, 24);
  }, [skus, allSkus]);

  const handleRefresh = useCallback(() => {
    setEditingCell(null);
    setAddForSkuWeek(null);
    onRefresh?.();
  }, [onRefresh]);

  const handleCellClick = useCallback(
    (cell: { id: string; skuId: string; skuCode: string; weekIndex: number; mechanic: string; discountPct: number; agentReason?: string | null } | null, weekIndex: number, sku: { id: string; skuCode: string; displayName?: string }) => {
      if (cell) {
        const el = document.querySelector("[data-editing-cell-anchor]") as HTMLElement;
        const rect = el?.getBoundingClientRect?.();
        setEditingCell({
          eventId: cell.id,
          skuCode: cell.skuCode,
          weekIndex: cell.weekIndex,
          mechanic: cell.mechanic,
          discountPct: cell.discountPct,
          agentReason: cell.agentReason,
          anchor: rect ? { x: rect.left, y: rect.bottom + 4 } : { x: 200, y: 200 },
        });
      } else {
        setAddForSkuWeek({ skuId: sku.id, skuCode: sku.skuCode, weekIndex });
      }
    },
    []
  );

  const handleWhyClick = useCallback((e: React.MouseEvent, skuName: string, weekLabel: string, reason: string) => {
    e.stopPropagation();
    setWhyPopover({ skuName, weekLabel, reason, x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!whyPopover) return;
    const close = () => setWhyPopover(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [whyPopover]);

  const cellsBySkuWeek = useMemo(() => {
    const map = new Map<string, { id: string; skuId: string; skuCode: string; category: string; weekIndex: number; mechanic: string; discountPct: number; expectedLift?: number; spend?: number; margin?: number; stockoutRisk?: number; roi?: number; agentReason?: string | null }>();
    const periodStart = new Date(2026, 2, 1); // Q2 start
    for (const e of promoEvents) {
      const start = new Date(e.periodStart);
      let weekIndex = Math.floor((start.getTime() - periodStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
      weekIndex = Math.max(0, Math.min(11, weekIndex));
      const key = `${e.skuId}-${weekIndex}`;
      const mechanic = e.promoType ?? "None";
      map.set(key, {
        id: e.id,
        skuId: e.skuId,
        skuCode: e.skuCode,
        category: e.category,
        weekIndex,
        mechanic,
        discountPct: e.discountDepth,
        expectedLift: 1.2,
        spend: e.baselineUnits * 0.5,
        margin: e.promoUnits * 0.3,
        stockoutRisk: 0.15,
        roi: 1.3,
        agentReason: e.agentReason ?? null,
      });
    }
    return map;
  }, [promoEvents]);

  const formatKpi = (key: string, value: unknown): string => {
    if (value == null) return "—";
    if (key === "revenue" || key === "spend" || key === "margin") {
      return `$${(Number(value) / 1e6).toFixed(2)} Million`;
    }
    if (key === "volume") return `${(Number(value) / 1e6).toFixed(2)} Million units`;
    if (key === "roi") return Number(value).toFixed(2);
    if (key === "risk") return `${(Number(value) * 100).toFixed(0)}%`;
    return String(value);
  };

  if (!scenarioId) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Select a scenario or create a new one.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 min-h-0 overflow-auto">
      {scenarioId && (
        <div className="flex-shrink-0">
          <AddPromoForm
            scenarioId={scenarioId}
            onAdded={handleRefresh}
            initialSkuId={addForSkuWeek?.skuId}
            initialWeekIndex={addForSkuWeek?.weekIndex}
          />
        </div>
      )}

      <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPI_KEYS.map(({ key, label, color }) => (
          <div
            key={key}
            className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3"
          >
            <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
            <div className={`mt-1 font-semibold ${color}`}>
              {formatKpi(key, kpiSummary?.[key])}
            </div>
          </div>
        ))}
      </div>

      <div className="flex-shrink-0 rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
        <h3 className="font-semibold text-slate-200 mb-2">SKU Grid ({skusForGrid.length} products)</h3>
        <div className="flex flex-wrap gap-2 max-h-24 overflow-auto">
          {skusForGrid.slice(0, 24).map((s) => (
            <span
              key={s.id}
              className="rounded-lg bg-slate-800/80 px-2 py-1 text-xs text-slate-300"
            >
              {s.displayName ?? s.skuCode}
            </span>
          ))}
        </div>
      </div>

      <ScenarioCalendar
        skus={skusForGrid}
        cellsBySkuWeek={cellsBySkuWeek}
        onCellClick={(cell, weekIndex, sku) => handleCellClick(cell, weekIndex, sku)}
        onWhyClick={handleWhyClick}
      />
      {whyPopover && (
        <div
          className="fixed z-30 rounded-lg border border-slate-600 bg-slate-800 p-3 shadow-xl max-w-xs text-sm"
          style={{ left: whyPopover.x + 8, top: whyPopover.y + 8 }}
        >
          <p className="font-medium text-slate-200 mb-1">Why this promotion?</p>
          <p className="text-slate-400 text-xs mb-1">{whyPopover.skuName} · {whyPopover.weekLabel}</p>
          <p className="text-slate-300 text-xs">{whyPopover.reason}</p>
          <button type="button" onClick={() => setWhyPopover(null)} className="mt-2 text-xs text-indigo-400 hover:underline">Close</button>
        </div>
      )}
      {editingCell && (
        <div
          className="fixed z-30"
          style={{ left: editingCell.anchor.x, top: editingCell.anchor.y }}
        >
          <EditCellPopover
            skuCode={editingCell.skuCode}
            weekLabel={`W${editingCell.weekIndex + 1}`}
            mechanic={editingCell.mechanic}
            discountPct={editingCell.discountPct}
            eventId={editingCell.eventId}
            scenarioId={scenarioId}
            agentReason={editingCell.agentReason}
            onSaved={handleRefresh}
            onClose={() => setEditingCell(null)}
          />
        </div>
      )}

      <AgentInsightPanel data={agentInsight} />
    </div>
  );
}
