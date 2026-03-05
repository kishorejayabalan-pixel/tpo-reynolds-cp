"use client";

import { useState, useCallback, useRef } from "react";
import { Cpu, Play, Square, Loader2, ChevronDown, ChevronUp } from "lucide-react";

type StreamEvent =
  | { type: "step"; step: string; message?: string }
  | { type: "tool_start"; name: string; args?: Record<string, unknown> }
  | { type: "tool_end"; name: string; durationMs?: number }
  | { type: "progress"; i: number; total: number; best?: { roi?: number; incMargin?: number; revenue?: number }; top5Preview?: Array<{ roi?: number; incMargin?: number; revenue?: number }> }
  | { type: "done"; result?: unknown }
  | { type: "error"; message: string };

interface StepEntry {
  id: number;
  time: string;
  event: StreamEvent;
}

const PERIOD = "2026-Q2";
const OBJECTIVE = "maximize_margin";
const SIMS = 1000;

export default function AgentConsole() {
  const [steps, setSteps] = useState<StepEntry[]>([]);
  const [progress, setProgress] = useState<{ i: number; total: number } | null>(null);
  const [top5Preview, setTop5Preview] = useState<Array<{ roi?: number; incMargin?: number; revenue?: number }>>([]);
  const [best, setBest] = useState<{ roi?: number; incMargin?: number; revenue?: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [doneResult, setDoneResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const stepIdRef = useRef(0);

  const startStream = useCallback(() => {
    setSteps([]);
    setProgress(null);
    setTop5Preview([]);
    setBest(null);
    setDoneResult(null);
    setError(null);
    stepIdRef.current = 0;
    setRunning(true);

    const url = `/api/agent/stream?period=${encodeURIComponent(PERIOD)}&objective=${encodeURIComponent(OBJECTIVE)}&sims=${SIMS}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as StreamEvent;
        const id = ++stepIdRef.current;
        setSteps((prev) => [...prev, { id, time: new Date().toLocaleTimeString(), event }]);

        if (event.type === "progress") {
          setProgress({ i: event.i, total: event.total });
          setBest(event.best ?? null);
          setTop5Preview(event.top5Preview ?? []);
        }
        if (event.type === "done") {
          setDoneResult(event.result ?? null);
          setRunning(false);
          es.close();
          eventSourceRef.current = null;
        }
        if (event.type === "error") {
          setError(event.message);
          setRunning(false);
          es.close();
          eventSourceRef.current = null;
        }
      } catch (err) {
        setError(String(err));
        setRunning(false);
        es.close();
      }
    };

    es.onerror = () => {
      setError("Stream connection lost");
      setRunning(false);
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setRunning(false);
  }, []);

  return (
    <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 flex flex-col overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50 flex items-center justify-between w-full text-left hover:bg-slate-800/50"
      >
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-indigo-400" />
          <h2 className="font-semibold text-slate-200">Agent Output (Live)</h2>
          {running && (
            <span className="flex items-center gap-1 text-amber-400 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              Streaming…
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        )}
      </button>

      {!collapsed && (
        <div className="flex-1 flex flex-col min-h-[280px] overflow-hidden">
          <div className="flex-shrink-0 p-3 border-b border-slate-700/50 flex items-center gap-2">
            <button
              type="button"
              onClick={running ? stopStream : startStream}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {running ? (
                <>
                  <Square className="h-4 w-4" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run optimization (live stream)
                </>
              )}
            </button>
            <span className="text-slate-500 text-xs">
              {PERIOD} · {OBJECTIVE} · {SIMS} sims
            </span>
          </div>

          {progress && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-slate-700/50">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Simulation progress</span>
                <span>
                  {progress.i} / {progress.total}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${(progress.i / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {top5Preview.length > 0 && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-slate-700/50">
              <p className="text-xs text-slate-400 mb-2">Top candidates (preview)</p>
              <div className="flex flex-wrap gap-2">
                {top5Preview.slice(0, 5).map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-slate-800/80 border border-slate-700/50 px-3 py-2 text-xs"
                  >
                    <span className="text-slate-500">#{i + 1}</span>{" "}
                    ROI {(s.roi ?? 0).toFixed(2)} · $
                    {((s.incMargin ?? 0) / 1e6).toFixed(2)}M margin
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto p-3 space-y-1 min-h-0">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}
            {steps.map(({ id, time, event }) => (
              <div
                key={id}
                className="rounded-lg bg-slate-800/50 border border-slate-700/30 px-3 py-2 text-xs font-mono"
              >
                <span className="text-slate-500">{time}</span>{" "}
                <span className="text-indigo-300">{event.type}</span>
                {event.type === "step" && event.message && (
                  <span className="text-slate-300 ml-2">{event.message}</span>
                )}
                {event.type === "tool_start" && (
                  <span className="text-slate-300 ml-2">
                    {event.name}
                    {event.args && ` ${JSON.stringify(event.args)}`}
                  </span>
                )}
                {event.type === "tool_end" && (
                  <span className="text-slate-300 ml-2">
                    {event.name} · {(event.durationMs ?? 0).toLocaleString()}ms
                  </span>
                )}
              </div>
            ))}
            {steps.length === 0 && !running && !error && (
              <p className="text-slate-500 text-sm">Click &quot;Run optimization (live stream)&quot; to see agent steps and progress.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
