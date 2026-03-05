"use client";

import { useState } from "react";
import { Sparkles, Loader2, MessageSquare, Send } from "lucide-react";

const OBJECTIVES = [
  "Max Margin",
  "Share Defense",
  "Inventory Safe",
  "Balanced Growth",
  "Cost Efficiency",
] as const;

interface Message {
  role: "agent" | "user";
  text: string;
}

export default function GenerateAgentPlanModal({
  open,
  onClose,
  onGenerated,
  sourceScenarioId,
  sourceScenarioName,
}: {
  open: boolean;
  onClose: () => void;
  onGenerated: (scenarioIds: string[]) => void;
  sourceScenarioId: string | null;
  sourceScenarioName: string;
}) {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      role: "agent",
      text: "What objective do you want for your agent-generated scenarios? You can pick one or describe your own (e.g. maximize margin, defend share, reduce stockout risk). I'll generate 5 scenarios based on your choice.",
    },
  ]);
  const [selectedObjective, setSelectedObjective] = useState<string>("Max Margin");
  const [customObjective, setCustomObjective] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const objective = customObjective.trim() || selectedObjective;

  const handleSelectObjective = (obj: string) => {
    setCustomObjective("");
    setSelectedObjective(obj);
    setMessages((m) => [
      ...m,
      { role: "user", text: obj },
      {
        role: "agent",
        text: `Got it — "${obj}". I'll create 5 scenarios with that objective. Click "Generate 5 scenarios" when ready.`,
      },
    ]);
  };

  const handleGenerate = async () => {
    if (!sourceScenarioId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/scenarios/workspace/generate-agent-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceScenarioId,
          objective,
          count: 5,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generate failed");
      const ids = (data.scenarios as Array<{ id: string }>)?.map((s) => s.id) ?? [];
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: `Done. Created 5 scenarios: ${(data.scenarios as Array<{ name: string }>)?.map((s) => s.name).join(", ")}. You can switch to them in the tabs.`,
        },
      ]);
      if (ids.length) {
        onGenerated(ids);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-lg flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-3">
          <Sparkles className="h-5 w-5 text-violet-400" />
          <h2 className="font-semibold text-slate-200">Generate Agent Plan</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-auto p-4 max-h-[50vh]">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 ${msg.role === "agent" ? "justify-start" : "justify-end"}`}
            >
              {msg.role === "agent" && (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-600/80">
                  <MessageSquare className="h-4 w-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "agent"
                    ? "bg-slate-800 text-slate-200"
                    : "bg-violet-600/80 text-white"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
            <p className="mb-2 text-xs font-medium text-slate-400">Choose objective (or type below)</p>
            <div className="flex flex-wrap gap-2">
              {OBJECTIVES.map((obj) => (
                <button
                  key={obj}
                  type="button"
                  onClick={() => handleSelectObjective(obj)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedObjective === obj && !customObjective
                      ? "bg-violet-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {obj}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Or type your own objective…"
              value={customObjective}
              onChange={(e) => setCustomObjective(e.target.value)}
              className="mt-2 w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-700 p-4">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !sourceScenarioId}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-3 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating 5 scenarios…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Generate 5 scenarios
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-700 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
