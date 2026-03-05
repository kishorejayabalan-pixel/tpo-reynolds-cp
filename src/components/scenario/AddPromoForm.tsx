"use client";

import { useState, useEffect } from "react";

const MECHANICS = ["TPR", "BOGO", "Display", "Feature", "All Price Off"] as const;

interface SkusResponse {
  skus: Array<{ id: string; skuCode: string; category: string; brand: string }>;
}

interface RetailersResponse {
  retailers: Array<{ id: string; name: string }>;
}

export default function AddPromoForm({
  scenarioId,
  onAdded,
  onCancel,
  initialSkuId,
  initialWeekIndex,
}: {
  scenarioId: string;
  onAdded: () => void;
  onCancel?: () => void;
  initialSkuId?: string | null;
  initialWeekIndex?: number | null;
}) {
  const [skus, setSkus] = useState<SkusResponse["skus"]>([]);
  const [retailers, setRetailers] = useState<RetailersResponse["retailers"]>([]);
  const [skuId, setSkuId] = useState(initialSkuId ?? "");
  const [retailerId, setRetailerId] = useState("");
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex ?? 0);
  const [mechanic, setMechanic] = useState<string>("TPR");
  const [discountPct, setDiscountPct] = useState(15);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSkuId) setSkuId(initialSkuId);
  }, [initialSkuId]);
  useEffect(() => {
    if (initialWeekIndex != null) setWeekIndex(initialWeekIndex);
  }, [initialWeekIndex]);

  useEffect(() => {
    fetch("/api/skus")
      .then((r) => r.json())
      .then((d) => d.skus && setSkus(d.skus));
    fetch("/api/retailers")
      .then((r) => r.json())
      .then((d) => {
        if (d.retailers?.length) {
          setRetailers(d.retailers);
          if (!retailerId) setRetailerId(d.retailers[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (skus.length && !skuId) setSkuId(skus[0].id);
  }, [skus, skuId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/scenarios/workspace/${scenarioId}/promo-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retailerId: retailerId || retailers[0]?.id,
          skuId,
          weekIndex,
          mechanic,
          discountPct,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add promotion");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 space-y-4">
      <h3 className="font-semibold text-slate-200">Add promotion</h3>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Retailer</label>
          <select
            value={retailerId}
            onChange={(e) => setRetailerId(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200"
          >
            {retailers.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">SKU</label>
          <select
            value={skuId}
            onChange={(e) => setSkuId(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200"
          >
            {skus.map((s) => (
              <option key={s.id} value={s.id}>{s.skuCode} ({s.category})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Week</label>
          <select
            value={weekIndex}
            onChange={(e) => setWeekIndex(parseInt(e.target.value, 10))}
            className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>W{i + 1}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Mechanic</label>
          <select
            value={mechanic}
            onChange={(e) => setMechanic(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200"
          >
            {MECHANICS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Discount %</label>
          <input
            type="number"
            min={0}
            max={50}
            step={1}
            value={discountPct}
            onChange={(e) => setDiscountPct(parseInt(e.target.value, 10) || 0)}
            className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !skuId}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add promotion"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
