"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  ShieldAlert,
  Calendar,
  MessageSquare,
  Play,
  Zap,
  AlertTriangle,
  TrendingDown,
  Loader2,
} from "lucide-react";

const PERIOD = "2026-Q2";
const HORIZON_WEEKS = 12;

interface KpiAggregate {
  revenue: number;
  units: number;
  margin: number;
  spend: number;
  roi: number;
  stockoutRisk: number;
}

interface DecisionEntry {
  id: string;
  createdAt: string;
  retailerId: string | null;
  agent: string;
  action: string;
  reason: string;
  beforeKpi: Record<string, unknown> | null;
  afterKpi: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
}

interface Retailer {
  id: string;
  name: string;
}

export default function DashboardShell() {
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [selectedRetailerId, setSelectedRetailerId] = useState<string>("");
  const [kpis, setKpis] = useState<KpiAggregate | null>(null);
  const [promoByRetailerWeek, setPromoByRetailerWeek] = useState<
    Record<string, Record<number, { promoType: string; discountDepth: number; skuCode: string }[]>>
  >({});
  const [decisionLog, setDecisionLog] = useState<DecisionEntry[]>([]);
  const [autopilotOn, setAutopilotOn] = useState(false);
  const [runOptLoading, setRunOptLoading] = useState(false);
  const [injectLoading, setInjectLoading] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    { role: "assistant", text: "Enter an objective (e.g. $10M revenue, ROI ≥ 1.25, spend cap $1.2M) and run optimization." },
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const fetchRetailers = useCallback(async () => {
    const res = await fetch("/api/retailers");
    const data = await res.json();
    if (data.retailers?.length) {
      setRetailers(data.retailers);
      if (!selectedRetailerId) setSelectedRetailerId(data.retailers[0].id);
    }
  }, [selectedRetailerId]);

  const fetchKpis = useCallback(async () => {
    const res = await fetch(`/api/kpis?period=${PERIOD}&horizonWeeks=${HORIZON_WEEKS}`);
    const data = await res.json();
    if (data.aggregate) setKpis(data.aggregate);
  }, []);

  const fetchPromoEvents = useCallback(async () => {
    const res = await fetch(`/api/promo-events?period=${PERIOD}&horizonWeeks=${HORIZON_WEEKS}`);
    const data = await res.json();
    if (data.byRetailerWeek) setPromoByRetailerWeek(data.byRetailerWeek);
  }, []);

  const fetchDecisionLog = useCallback(async () => {
    const res = await fetch("/api/decision-log?limit=20");
    const data = await res.json();
    if (data.entries) setDecisionLog(data.entries);
  }, []);

  useEffect(() => {
    fetchRetailers();
  }, []);

  useEffect(() => {
    fetchKpis();
    fetchPromoEvents();
    fetchDecisionLog();
    const t = setInterval(() => {
      fetchKpis();
      fetchPromoEvents();
      fetchDecisionLog();
    }, 15000);
    return () => clearInterval(t);
  }, [fetchKpis, fetchPromoEvents, fetchDecisionLog]);

  useEffect(() => {
    if (!autopilotOn) return;
    const t = setInterval(async () => {
      await fetch("/api/autopilot/run", { method: "POST" });
      fetchKpis();
      fetchPromoEvents();
      fetchDecisionLog();
    }, 10000);
    return () => clearInterval(t);
  }, [autopilotOn, fetchKpis, fetchPromoEvents, fetchDecisionLog]);

  const runOptimization = async () => {
    if (!selectedRetailerId) return;
    setRunOptLoading(true);
    try {
      const res = await fetch("/api/tpo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retailerId: selectedRetailerId,
          period: PERIOD,
          horizonWeeks: HORIZON_WEEKS,
        }),
      });
      const data = await res.json();
      if (data.bestPlan?.kpi) setKpis(data.bestPlan.kpi);
      fetchPromoEvents();
      fetchDecisionLog();
    } finally {
      setRunOptLoading(false);
    }
  };

  const injectSignal = async (type: string) => {
    setInjectLoading(type);
    try {
      await fetch("/api/signals/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      fetchDecisionLog();
    } finally {
      setInjectLoading(null);
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    setChatLoading(true);
    const text = chatInput;
    setChatInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });
      const data = await res.json();
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((m) => [...m, { role: "assistant", text: data.reply ?? data.error ?? "Done." }]);
      if (data.runResult) {
        fetchKpis();
        fetchPromoEvents();
        fetchDecisionLog();
      }
    } finally {
      setChatLoading(false);
    }
  };

  const retailerNames = Object.keys(promoByRetailerWeek);
  const weeks = Array.from({ length: HORIZON_WEEKS }, (_, i) => i);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="w-56 flex-shrink-0 bg-slate-900/95 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-600/80 flex items-center justify-center">
              <Image src="/rcp-logo.svg" alt="Reynolds CP" width={28} height={28} className="object-contain invert" />
            </div>
            <div>
              <p className="font-semibold text-sm">Reynolds CP</p>
              <p className="text-xs text-slate-500">TPO Suite</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <DollarSign className="h-4 w-4" />
            Overview
          </button>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex-shrink-0 border-b border-slate-800 bg-slate-900/50 px-6 py-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Revenue</span>
                <DollarSign className="h-4 w-4 text-slate-500" />
              </div>
              <p className="mt-1 text-xl font-semibold text-white">
                {kpis != null ? `$${(kpis.revenue / 1e6).toFixed(2)}M` : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">ROI</span>
                <TrendingUp className="h-4 w-4 text-slate-500" />
              </div>
              <p className="mt-1 text-xl font-semibold text-white">
                {kpis != null ? kpis.roi.toFixed(2) : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Spend</span>
                <Wallet className="h-4 w-4 text-slate-500" />
              </div>
              <p className="mt-1 text-xl font-semibold text-white">
                {kpis != null ? `$${(kpis.spend / 1e6).toFixed(2)}M` : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Stockout Risk</span>
                <ShieldAlert className="h-4 w-4 text-slate-500" />
              </div>
              <p className="mt-1 text-xl font-semibold text-white">
                {kpis != null ? `${(kpis.stockoutRisk * 100).toFixed(0)}%` : "—"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              value={selectedRetailerId}
              onChange={(e) => setSelectedRetailerId(e.target.value)}
              className="rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200"
            >
              {retailers.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button
              onClick={runOptimization}
              disabled={runOptLoading || !selectedRetailerId}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {runOptLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Optimization
            </button>
            <button
              onClick={() => setAutopilotOn((o) => !o)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${autopilotOn ? "bg-amber-600 text-white" : "bg-slate-700 text-slate-300"}`}
            >
              <Zap className="h-4 w-4" />
              Autopilot {autopilotOn ? "ON" : "OFF"}
            </button>
            <span className="text-slate-500 text-sm">Inject signal:</span>
            <button
              onClick={() => injectSignal("competitor_drop")}
              disabled={injectLoading !== null}
              className="flex items-center gap-1 rounded bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-50"
            >
              {injectLoading === "competitor_drop" ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingDown className="h-3 w-3" />}
              Competitor drop
            </button>
            <button
              onClick={() => injectSignal("inventory_delay")}
              disabled={injectLoading !== null}
              className="flex items-center gap-1 rounded bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-50"
            >
              {injectLoading === "inventory_delay" ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
              Inventory delay
            </button>
            <button
              onClick={() => injectSignal("demand_spike")}
              disabled={injectLoading !== null}
              className="flex items-center gap-1 rounded bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-50"
            >
              {injectLoading === "demand_spike" ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />}
              Demand spike
            </button>
          </div>
        </header>

        <main className="flex-1 flex min-h-0 p-6 gap-6 overflow-hidden">
          <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-hidden">
            <section className="flex-1 min-h-0 rounded-xl border border-slate-700/50 bg-slate-900/40 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-400" />
                <h2 className="font-semibold text-slate-200">Promo Calendar (Retailer × Week)</h2>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <div className="inline-block min-w-full">
                  <table className="text-sm">
                    <thead>
                      <tr>
                        <th className="text-left py-2 pr-4 text-slate-400 font-medium">Retailer</th>
                        {weeks.map((w) => (
                          <th key={w} className="w-14 py-2 text-center text-slate-500 font-normal">W{w + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {retailerNames.length === 0 ? (
                        <tr><td colSpan={weeks.length + 1} className="py-4 text-slate-500">No promo events. Run seed or optimization.</td></tr>
                      ) : (
                        retailerNames.map((name) => (
                          <tr key={name} className="border-t border-slate-700/30">
                            <td className="py-1.5 pr-4 text-slate-300 font-medium">{name}</td>
                            {weeks.map((w) => {
                              const cell = promoByRetailerWeek[name]?.[w];
                              return (
                                <td key={w} className="w-14 py-1.5">
                                  <div className="flex flex-col gap-0.5 items-center justify-center rounded bg-slate-800/50 border border-slate-700/30 py-1 px-0.5 min-h-[2rem]">
                                    {cell?.length ? (
                                      cell.slice(0, 2).map((p, i) => (
                                        <span key={i} className="text-[10px] text-indigo-300 truncate max-w-full" title={`${p.promoType} ${(p.discountDepth * 100).toFixed(0)}%`}>
                                          {p.promoType}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-slate-600 text-[10px]">—</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="h-48 flex-shrink-0 rounded-xl border border-slate-700/50 bg-slate-900/40 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-indigo-400" />
                <h2 className="font-semibold text-slate-200">Decision Log</h2>
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-2">
                {decisionLog.length === 0 ? (
                  <p className="text-slate-500 text-sm">No decisions yet.</p>
                ) : (
                  decisionLog.map((e) => (
                    <div key={e.id} className="rounded-lg bg-slate-800/50 border border-slate-700/30 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>{new Date(e.createdAt).toLocaleString()}</span>
                        <span className="font-medium text-indigo-300">{e.agent}</span>
                        <span>{e.action}</span>
                      </div>
                      <p className="mt-1 text-slate-300">{e.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <section className="w-[380px] flex-shrink-0 rounded-xl border border-slate-700/50 bg-slate-900/40 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              <h2 className="font-semibold text-slate-200">Chat (objectives → constraints)</h2>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-3 py-2 text-sm ${m.role === "assistant" ? "bg-indigo-500/10 text-slate-200 border border-indigo-500/20" : "bg-slate-800/60 text-slate-300"}`}
                >
                  {m.text}
                </div>
              ))}
            </div>
            <div className="flex-shrink-0 p-3 border-t border-slate-700/50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="e.g. $10M revenue, ROI ≥ 1.25, spend cap $1.2M"
                  className="flex-1 rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <button
                  type="button"
                  onClick={sendChat}
                  disabled={chatLoading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
