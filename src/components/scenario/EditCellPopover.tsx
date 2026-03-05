"use client";

import { useState } from "react";

const MECHANICS = ["TPR", "BOGO", "Display", "Feature", "All Price Off"] as const;

export default function EditCellPopover({
  skuCode,
  weekLabel,
  mechanic,
  discountPct,
  eventId,
  scenarioId,
  onSaved,
  onClose,
}: {
  skuCode: string;
  weekLabel: string;
  mechanic: string;
  discountPct: number;
  eventId: string;
  scenarioId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [mechanicVal, setMechanicVal] = useState(mechanic);
  const [discountVal, setDiscountVal] = useState(Math.round(discountPct * 100));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/scenarios/workspace/${scenarioId}/promo-events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mechanic: mechanicVal, discountPct: discountVal }),
      });
      if (!res.ok) throw new Error("Update failed");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute z-20 rounded-lg border border-slate-600 bg-slate-800 p-3 shadow-xl min-w-[200px]">
      <p className="text-xs text-slate-400 mb-2">{skuCode} · {weekLabel}</p>
      <div className="space-y-2">
        <div>
          <label className="block text-[10px] text-slate-500">Mechanic</label>
          <select
            value={mechanicVal}
            onChange={(e) => setMechanicVal(e.target.value)}
            className="w-full rounded bg-slate-700 border border-slate-600 px-2 py-1 text-xs text-slate-200"
          >
            {MECHANICS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500">Discount %</label>
          <input
            type="number"
            min={0}
            max={50}
            value={discountVal}
            onChange={(e) => setDiscountVal(parseInt(e.target.value, 10) || 0)}
            className="w-full rounded bg-slate-700 border border-slate-600 px-2 py-1 text-xs text-slate-200"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-500"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
