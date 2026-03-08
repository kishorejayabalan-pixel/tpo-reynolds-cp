"use client";

import { useState } from "react";
import { Sparkles, Box, TrendingUp, BarChart3, Zap, ChevronDown, ChevronUp, Info } from "lucide-react";

const FEATURES = [
  {
    icon: Box,
    title: "Planning sandbox",
    description: "Build and compare promo scenarios in a single workspace. Clone baselines, tweak events, and see KPIs update in real time.",
  },
  {
    icon: TrendingUp,
    title: "Elasticities & synthetic fallback",
    description: "Prioritization uses price and promo elasticities by category. When real elasticity data isn't available, the tool uses synthetic metrics so you can still run and compare plans.",
  },
  {
    icon: Zap,
    title: "Exceedra event inputs",
    description: "Promo events are driven by Exceedra-style event data (retailer, SKU, period, mechanic, depth). In this environment, Exceedra integration runs on synthetic event data so you can demo end-to-end without a live feed.",
  },
  {
    icon: BarChart3,
    title: "Predicted incremental outcomes",
    description: "Every scenario predicts incremental volume, revenue, and profit (as margin). Use these to choose the plan that best balances volume growth and trade spend.",
  },
  {
    icon: Sparkles,
    title: "Trade optimization",
    description: "Objectives and levers (price and promotion) are aligned to increase volumes and minimize TP spend. The agent applies guidelines and optimal depth to drive plan effectiveness and efficiency.",
  },
];

export default function FeatureHighlights() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-200 hover:bg-slate-800/60 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Info className="h-4 w-4 text-indigo-400" />
          How this tool works
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 space-y-3 border-t border-slate-700/50">
          <p className="text-xs text-slate-400 pt-2">
            The Promo Scenario Planning Tool is a planning sandbox that uses elasticities and Exceedra-style event inputs to predict incremental volume, revenue, and profit and drive trade optimization.
          </p>
          <ul className="space-y-2.5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <li key={i} className="flex gap-2.5">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-200">{f.title}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{f.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
