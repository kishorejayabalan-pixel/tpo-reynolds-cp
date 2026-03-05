"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, LayoutGrid } from "lucide-react";

export interface WorkspaceScenario {
  id: string;
  name: string;
  status: "DRAFT" | "COMMITTED" | "AGENT_GENERATED";
  kpiSummary: Record<string, unknown> | null;
  objectiveJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  promoEventCount?: number;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-600/80 text-slate-200 border-slate-500",
  COMMITTED: "bg-emerald-600/80 text-white border-emerald-500",
  AGENT_GENERATED: "bg-violet-600/80 text-white border-violet-400",
};

export default function ScenarioTabs({
  activeId,
  onSelect,
  onNewScenario,
  compareMode,
  onToggleCompare,
  scenarios: scenariosProp,
  onScenariosChange,
  loading: loadingProp,
  children,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewScenario: () => void;
  compareMode?: boolean;
  onToggleCompare?: () => void;
  scenarios?: WorkspaceScenario[];
  onScenariosChange?: (s: WorkspaceScenario[]) => void;
  loading?: boolean;
  children: React.ReactNode;
}) {
  const [internalScenarios, setInternalScenarios] = useState<WorkspaceScenario[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);

  const fetchScenarios = useCallback(async () => {
    try {
      const res = await fetch("/api/scenarios/workspace");
      const data = await res.json();
      const list = data.scenarios ?? [];
      setInternalScenarios(list);
      onScenariosChange?.(list);
    } finally {
      setInternalLoading(false);
    }
  }, [onScenariosChange]);

  useEffect(() => {
    if (scenariosProp === undefined) fetchScenarios();
    else setInternalScenarios(scenariosProp);
  }, [scenariosProp, fetchScenarios]);

  const scenarios = scenariosProp ?? internalScenarios;
  const loading = loadingProp ?? internalLoading;

  const isAgent = (s: WorkspaceScenario) => s.status === "AGENT_GENERATED";
  const isRisk = (s: WorkspaceScenario) => s.name.toLowerCase().includes("risk");

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 flex items-center gap-2 border-b border-slate-700/50 bg-slate-900/60 px-3 py-2">
        <LayoutGrid className="h-4 w-4 text-indigo-400" />
        <span className="font-semibold text-slate-200 text-sm">Scenario Workspace</span>
        <div className="flex-1 flex items-center gap-1 overflow-x-auto min-w-0">
          {loading ? (
            <span className="text-slate-500 text-xs">Loading…</span>
          ) : (
            scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                className={`
                  flex-shrink-0 flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-medium transition-all
                  ${activeId === s.id
                    ? "bg-gradient-to-b from-indigo-500/90 to-indigo-600/90 text-white shadow-md"
                    : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
                  }
                  ${isAgent(s) && activeId !== s.id ? "ring-1 ring-violet-400/50" : ""}
                  ${isRisk(s) && activeId !== s.id ? "ring-1 ring-amber-400/50" : ""}
                `}
              >
                <span className="truncate max-w-[140px]">{s.name}</span>
                <span
                  className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium border ${STATUS_STYLES[s.status] ?? STATUS_STYLES.DRAFT}`}
                >
                  {s.status.replace("_", " ")}
                </span>
              </button>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={onNewScenario}
          className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          New Scenario
        </button>
        {onToggleCompare && (
          <button
            type="button"
            onClick={onToggleCompare}
            className={`flex-shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${compareMode ? "bg-teal-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
          >
            Compare Scenarios
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
