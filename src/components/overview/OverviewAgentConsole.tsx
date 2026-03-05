"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Cpu, Play, Square, Loader2, ListChecks, History } from "lucide-react";

type StreamEvent =
  | { type: "step"; step: string; message?: string }
  | { type: "tool_start"; name: string; args?: Record<string, unknown> }
  | { type: "tool_end"; name: string; durationMs?: number }
  | { type: "progress"; i: number; total: number; best?: unknown; top5Preview?: unknown[] }
  | { type: "done"; result?: unknown }
  | { type: "error"; message: string };

interface StepEntry {
  id: number;
  time: string;
  event: StreamEvent;
}

interface DecisionEntry {
  id: string;
  createdAt: string;
  agent: string;
  action: string;
  reason: string;
  explanation: string | null;
}

const PERIOD = "2026-Q2";
const OBJECTIVE = "maximize_margin";
const SIMS = 1000;

interface OverviewAgentConsoleProps {
  scenarioId: string;
  retailerId: string;
  approvalMode: string;
  onRefresh: () => void;
}

export default function OverviewAgentConsole({
  scenarioId,
  retailerId,
  approvalMode,
  onRefresh,
}: OverviewAgentConsoleProps) {
  const [tab, setTab] = useState<"trace" | "decisions" | "audit">("trace");
  const [steps, setSteps] = useState<StepEntry[]>([]);
  const [progress, setProgress] = useState<{ i: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<DecisionEntry[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const stepIdRef = useRef(0);

  const startStream = useCallback(() => {
    setSteps([]);
    setProgress(null);
    setError(null);
    stepIdRef.current = 0;
    setRunning(true);
    const params = new URLSearchParams({ period: PERIOD, objective: OBJECTIVE, sims: String(SIMS) });
    if (scenarioId) params.set("scenarioId", scenarioId);
    if (retailerId) params.set("retailerId", retailerId);
    const es = new EventSource(`/api/agent/stream?${params}`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as StreamEvent;
        const id = ++stepIdRef.current;
        setSteps((prev) => [...prev, { id, time: new Date().toLocaleTimeString(), event }]);
        if (event.type === "progress") setProgress({ i: event.i, total: event.total });
        if (event.type === "done" || event.type === "error") {
          setRunning(false);
          es.close();
          eventSourceRef.current = null;
          if (event.type === "error") setError(event.message);
        }
      } catch {
        setError("Parse error");
        setRunning(false);
        es.close();
      }
    };
    es.onerror = () => {
      setError("Stream lost");
      setRunning(false);
      es.close();
      eventSourceRef.current = null;
    };
  }, [scenarioId, retailerId]);

  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setRunning(false);
  }, []);

  const fetchDecisions = useCallback(() => {
    const params = new URLSearchParams({ limit: "10" });
    if (retailerId) params.set("retailerId", retailerId);
    fetch(`/api/decision-log?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.entries) setDecisions(d.entries);
      });
  }, [retailerId]);

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions]);

  const stepLabel = (step: string) => {
    if (step === "start") return "Parsing objective";
    if (step === "simulate") return "Running simulations";
    return step.replace(/_/g, " ");
  };

  return (
    <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 flex flex-col overflow-hidden min-h-[360px]">
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
        <Cpu className="h-4 w-4 text-violet-400" />
        <h2 className="font-semibold text-slate-200">Agent Console</h2>
      </div>
      <div className="flex border-b border-slate-700/50">
        <button
          type="button"
          onClick={() => setTab("trace")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${tab === "trace" ? "text-violet-300 border-b-2 border-violet-500 bg-slate-800/50" : "text-slate-400 hover:text-slate-300"}`}
        >
          <Cpu className="h-3.5 w-3.5" />
          Live Trace
        </button>
        <button
          type="button"
          onClick={() => setTab("decisions")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${tab === "decisions" ? "text-violet-300 border-b-2 border-violet-500 bg-slate-800/50" : "text-slate-400 hover:text-slate-300"}`}
        >
          <ListChecks className="h-3.5 w-3.5" />
          Decisions
        </button>
        <button
          type="button"
          onClick={() => setTab("audit")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${tab === "audit" ? "text-violet-300 border-b-2 border-violet-500 bg-slate-800/50" : "text-slate-400 hover:text-slate-300"}`}
        >
          <History className="h-3.5 w-3.5" />
          Audit
        </button>
      </div>

      {tab === "trace" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-shrink-0 p-2 border-b border-slate-700/50 flex items-center gap-2">
            <button
              type="button"
              onClick={running ? stopStream : startStream}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {running ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {running ? "Stop" : "Run stream"}
            </button>
            {running && (
              <span className="flex items-center gap-1 text-amber-400 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Streaming…
              </span>
            )}
          </div>
          {progress && (
            <div className="flex-shrink-0 px-3 py-2">
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all"
                  style={{ width: `${(progress.i / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex-1 overflow-auto p-2 space-y-1 min-h-0">
            {error && (
              <div className="rounded bg-red-500/10 border border-red-500/30 px-2 py-1.5 text-xs text-red-300">
                {error}
              </div>
            )}
            {steps.map(({ id, time, event }) => (
              <div key={id} className="rounded bg-slate-800/50 border border-slate-700/30 px-2 py-1.5 text-xs">
                <span className="text-slate-500">{time}</span>{" "}
                <span className="text-violet-300">
                  {event.type === "step" ? stepLabel((event as { step: string }).step) : event.type}
                </span>
                {event.type === "step" && (event as { message?: string }).message && (
                  <span className="text-slate-400 ml-1">{(event as { message: string }).message}</span>
                )}
              </div>
            ))}
            {steps.length === 0 && !running && !error && (
              <p className="text-slate-500 text-xs">Click &quot;Run stream&quot; to see live trace.</p>
            )}
          </div>
        </div>
      )}

      {tab === "decisions" && (
        <div className="flex-1 overflow-auto p-2 space-y-1 min-h-0">
          {decisions.length === 0 ? (
            <p className="text-slate-500 text-xs">No decisions yet.</p>
          ) : (
            decisions.map((e) => (
              <div key={e.id} className="rounded bg-slate-800/50 border border-slate-700/30 px-2 py-2 text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <span>{new Date(e.createdAt).toLocaleString()}</span>
                  <span className="font-medium text-violet-300">{e.agent}</span>
                </div>
                <p className="text-slate-300 mt-1">{e.reason}</p>
                {e.explanation && <p className="text-slate-500 mt-1">{e.explanation}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "audit" && (
        <div className="flex-1 overflow-auto p-2 min-h-0">
          <p className="text-slate-500 text-xs">Audit log of applied changes. Same as Decisions when no approval workflow.</p>
          {approvalMode === "RequireApproval" && (
            <div className="mt-2 rounded bg-amber-500/10 border border-amber-500/30 px-2 py-2 text-xs text-amber-200">
              Approval required. Pending changes will show Approve / Reject here.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
