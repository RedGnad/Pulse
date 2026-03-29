"use client";

import { useState } from "react";
import { useNetwork } from "@/contexts/network-context";
import { DeployAdvice, StakeAdvice, BridgeAdvice, AdvisorType } from "@/lib/types";
import {
  Loader2, ChevronRight, AlertTriangle, Rocket, Coins, ArrowLeftRight,
  CheckCircle2, XCircle, Info, TrendingUp, Shield, Clock, Database,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_TYPES = ["General dApp", "DeFi / DEX", "Gaming / NFT", "Social", "Infra / Bridge", "Data / Oracle"];

const NEEDS_OPTIONS = [
  { id: "oracle",     label: "Price Oracle",     desc: "ConnectOracle feeds" },
  { id: "fast",       label: "Fast finality",    desc: "< 2s block time" },
  { id: "ibc",        label: "IBC connectivity", desc: "Cross-chain transfers" },
  { id: "evm",        label: "EVM compatible",   desc: "Solidity / EVM tooling" },
  { id: "lowcost",    label: "Low gas fees",      desc: "Cost-efficient execution" },
  { id: "celestia",   label: "Celestia DA",       desc: "Celestia data availability" },
];

const TOKENS = ["INIT", "ETH", "USDC", "TIA", "BTC"];

const RISK_LABELS: Record<string, string> = {
  conservative: "Conservative — prioritize safety over yield",
  balanced:     "Balanced — mix of safety and performance",
  aggressive:   "Aggressive — maximize yield, accept more risk",
};

// ─── Tab selector ─────────────────────────────────────────────────────────────

type Tab = AdvisorType;

const TABS: { id: Tab; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    id: "deploy",
    icon: <Rocket className="h-4 w-4" />,
    label: "Deploy",
    desc: "Find the best minitia for your app",
  },
  {
    id: "stake",
    icon: <Coins className="h-4 w-4" />,
    label: "Stake",
    desc: "Optimize your INIT staking strategy",
  },
  {
    id: "bridge",
    icon: <ArrowLeftRight className="h-4 w-4" />,
    label: "Bridge",
    desc: "Optimal path between chains",
  },
];

// ─── Deploy form + result ──────────────────────────────────────────────────────

function DeployForm({ onResult }: { onResult: (a: DeployAdvice, grounded: boolean) => void }) {
  const { network } = useNetwork();
  const [appType, setAppType]   = useState("General dApp");
  const [needs,   setNeeds]     = useState<string[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);

  function toggleNeed(id: string) {
    setNeeds(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "deploy", params: { appType, needs }, network }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      onResult(json.advice as DeployAdvice, !!json.oracleGrounded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {/* App type */}
      <div>
        <label className="mb-2 block font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">
          Application type
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {APP_TYPES.map(t => (
            <button
              key={t} type="button"
              onClick={() => setAppType(t)}
              className={`rounded-sm border px-3 py-2 font-mono text-xs transition-colors text-left
                ${appType === t
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/50 bg-card/40 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Needs */}
      <div>
        <label className="mb-2 block font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">
          Technical requirements
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NEEDS_OPTIONS.map(n => {
            const active = needs.includes(n.id);
            return (
              <button
                key={n.id} type="button"
                onClick={() => toggleNeed(n.id)}
                className={`rounded-sm border px-3 py-2 text-left transition-colors
                  ${active
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/50 bg-card/40 hover:border-primary/20"
                  }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${active ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  <span className={`font-mono text-[11px] font-semibold ${active ? "text-primary" : "text-foreground/70"}`}>
                    {n.label}
                  </span>
                </div>
                <p className="mt-0.5 pl-3.5 font-mono text-[11px] text-muted-foreground">{n.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-sm border border-red-400/30 bg-red-400/5 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          <span className="font-mono text-xs text-red-400">{error}</span>
        </div>
      )}

      <button
        type="submit" disabled={loading}
        className="flex items-center justify-center gap-2 rounded-sm border border-primary/30 bg-primary/10 px-4 py-2.5 font-mono text-xs tracking-widest text-primary uppercase transition-colors hover:bg-primary/20 disabled:opacity-40"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
        {loading ? "Analyzing rollup ecosystem…" : "Get Deployment Advice"}
      </button>
    </form>
  );
}

function DeployResult({ advice }: { advice: DeployAdvice }) {
  return (
    <div className="flex flex-col gap-4 animate-slide-up">
      {/* Top recommendation */}
      <div className="relative overflow-hidden rounded-sm border border-primary/30 bg-primary/[0.06] p-5">
        <div className="absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-primary/0 via-primary to-primary/0" />
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">Top Recommendation</span>
          <span className="rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
            Score {advice.top_chain.score}/100
          </span>
        </div>
        <p className="text-lg font-bold text-foreground">{advice.top_chain.prettyName}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{advice.top_chain.chainId}</p>
        <p className="mt-2 text-sm text-foreground/80">{advice.top_chain.reason}</p>
      </div>

      {/* Alternatives */}
      {advice.alternatives?.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">Alternatives</p>
          <div className="flex flex-col gap-2">
            {advice.alternatives.map((alt, i) => (
              <div key={i} className="flex items-start gap-3 rounded-sm border border-border/50 bg-card/40 p-3">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-border/60 font-mono text-[11px] text-muted-foreground">
                  {i + 2}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{alt.prettyName}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{alt.score}/100</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{alt.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rationale */}
      <div className="rounded-sm border border-border/40 bg-card/30 p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-primary/60" />
          <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Analysis</span>
        </div>
        <p className="text-xs leading-relaxed text-foreground/80">{advice.rationale}</p>
      </div>

      {/* Warnings */}
      {advice.warnings?.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {advice.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-sm border border-amber-400/20 bg-amber-400/5 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
              <p className="text-xs text-foreground/80">{w}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stake form + result ───────────────────────────────────────────────────────

function StakeForm({ onResult }: { onResult: (a: StakeAdvice, grounded: boolean) => void }) {
  const { network } = useNetwork();
  const [amount,      setAmount]      = useState(1000);
  const [riskProfile, setRiskProfile] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "stake", params: { amount, riskProfile }, network }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      onResult(json.advice as StakeAdvice, !!json.oracleGrounded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {/* Amount */}
      <div>
        <label className="mb-2 block font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">
          INIT amount to stake
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number" min={1} value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            className="w-40 rounded-sm border border-border/60 bg-card/40 px-3 py-2 font-mono text-sm text-foreground focus:border-primary/40 focus:outline-none"
          />
          <span className="font-mono text-sm text-primary">INIT</span>
        </div>
        <div className="mt-2 flex gap-2">
          {[100, 1000, 10000, 50000].map(v => (
            <button
              key={v} type="button"
              onClick={() => setAmount(v)}
              className={`rounded border px-2 py-0.5 font-mono text-[11px] transition-colors
                ${amount === v ? "border-primary/40 bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-primary/20"}`}
            >
              {v.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Risk profile */}
      <div>
        <label className="mb-2 block font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">
          Risk profile
        </label>
        <div className="flex flex-col gap-2">
          {(["conservative", "balanced", "aggressive"] as const).map(r => (
            <button
              key={r} type="button"
              onClick={() => setRiskProfile(r)}
              className={`rounded-sm border px-3 py-2 text-left transition-colors
                ${riskProfile === r
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/50 bg-card/40 hover:border-primary/20"
                }`}
            >
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full flex-shrink-0
                  ${r === "conservative" ? "bg-emerald-400" : r === "balanced" ? "bg-primary" : "bg-red-400"}`}
                />
                <span className={`font-mono text-xs font-semibold capitalize
                  ${riskProfile === r ? "text-primary" : "text-foreground/70"}`}>
                  {r}
                </span>
              </div>
              <p className="mt-0.5 pl-4 text-[11px] text-muted-foreground">{RISK_LABELS[r]}</p>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-sm border border-red-400/30 bg-red-400/5 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          <span className="font-mono text-xs text-red-400">{error}</span>
        </div>
      )}

      <button
        type="submit" disabled={loading}
        className="flex items-center justify-center gap-2 rounded-sm border border-primary/30 bg-primary/10 px-4 py-2.5 font-mono text-xs tracking-widest text-primary uppercase transition-colors hover:bg-primary/20 disabled:opacity-40"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
        {loading ? "Scoring validators…" : "Get Staking Strategy"}
      </button>
    </form>
  );
}

function StakeResult({ advice }: { advice: StakeAdvice }) {
  return (
    <div className="flex flex-col gap-4 animate-slide-up">
      {/* Strategy */}
      <div className="relative overflow-hidden rounded-sm border border-primary/20 bg-primary/[0.04] p-4">
        <div className="absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-primary/0 via-primary to-primary/0" />
        <div className="mb-1 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary/60" />
          <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Strategy</span>
        </div>
        <p className="text-sm leading-relaxed text-foreground/90">{advice.strategy}</p>
      </div>

      {/* Recommendations */}
      <div>
        <p className="mb-2 font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">Top Validators</p>
        <div className="flex flex-col gap-2">
          {advice.recommendations?.map((rec, i) => (
            <div key={i} className="rounded-sm border border-border/50 bg-card/40 p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-primary/30 font-mono text-[11px] text-primary">
                    {i + 1}
                  </span>
                  <span className="font-semibold text-foreground">{rec.moniker}</span>
                </div>
                <span className={`rounded-sm border px-2 py-0.5 font-mono text-[11px] font-bold
                  ${rec.score >= 80
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                    : rec.score >= 60
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-amber-400/30 bg-amber-400/10 text-amber-400"
                  }`}>
                  {rec.score}/100
                </span>
              </div>
              <p className="mb-2 text-xs text-foreground/80">{rec.rationale}</p>
              {rec.risks?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {rec.risks.map((risk, j) => (
                    <span key={j} className="flex items-center gap-1 rounded border border-amber-400/20 bg-amber-400/5 px-1.5 py-0.5 font-mono text-[11px] text-amber-400">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {risk}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {advice.warnings?.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {advice.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-sm border border-amber-400/20 bg-amber-400/5 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
              <p className="text-xs text-foreground/80">{w}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Bridge form + result ──────────────────────────────────────────────────────

const KNOWN_CHAINS = [
  { id: "initiation-2", label: "initiation-2 (L1)" },
  { id: "minimove-1",   label: "minimove-1" },
  { id: "miniwasm-1",   label: "miniwasm-1" },
  { id: "blackwing-1",  label: "Blackwing" },
];

function BridgeForm({ onResult }: { onResult: (a: BridgeAdvice, grounded: boolean) => void }) {
  const { network } = useNetwork();
  const [token,     setToken]     = useState("INIT");
  const [fromChain, setFromChain] = useState(network === "mainnet" ? "interwoven-1" : "initiation-2");
  const [toChain,   setToChain]   = useState(network === "mainnet" ? "inertia-1" : "minimove-1");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (fromChain === toChain) {
      setError("Source and destination chains must differ.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bridge", params: { token, fromChain, toChain }, network }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      onResult(json.advice as BridgeAdvice, !!json.oracleGrounded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const ChainSelect = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <label className="mb-1.5 block font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">{label}</label>
      <div className="flex flex-col gap-1.5">
        {KNOWN_CHAINS.map(c => (
          <button
            key={c.id} type="button"
            onClick={() => onChange(c.id)}
            className={`rounded-sm border px-3 py-2 text-left font-mono text-xs transition-colors
              ${value === c.id
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/50 bg-card/40 text-muted-foreground hover:border-primary/20"
              }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {/* Token */}
      <div>
        <label className="mb-2 block font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">Token</label>
        <div className="flex flex-wrap gap-2">
          {TOKENS.map(t => (
            <button
              key={t} type="button"
              onClick={() => setToken(t)}
              className={`rounded-sm border px-3 py-1.5 font-mono text-xs transition-colors
                ${token === t
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/50 bg-card/40 text-muted-foreground hover:border-primary/20"
                }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Chains */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChainSelect label="From chain" value={fromChain} onChange={setFromChain} />
        <ChainSelect label="To chain"   value={toChain}   onChange={setToChain} />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-sm border border-red-400/30 bg-red-400/5 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          <span className="font-mono text-xs text-red-400">{error}</span>
        </div>
      )}

      <button
        type="submit" disabled={loading}
        className="flex items-center justify-center gap-2 rounded-sm border border-primary/30 bg-primary/10 px-4 py-2.5 font-mono text-xs tracking-widest text-primary uppercase transition-colors hover:bg-primary/20 disabled:opacity-40"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}
        {loading ? "Routing across rollups…" : "Find Optimal Route"}
      </button>
    </form>
  );
}

function BridgeResult({ advice }: { advice: BridgeAdvice }) {
  return (
    <div className="flex flex-col gap-4 animate-slide-up">
      {/* Path */}
      <div className="rounded-sm border border-primary/20 bg-card/40 p-4">
        <p className="mb-3 font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">Route</p>
        <div className="flex flex-wrap items-center gap-2">
          {advice.path?.map((chain, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="rounded-sm border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-xs text-primary">
                {chain}
              </span>
              {i < advice.path.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary/60" />
          <span className="font-mono text-xs text-primary">Total time: {advice.total_time}</span>
        </div>
      </div>

      {/* Steps */}
      {advice.steps?.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">Steps</p>
          <div className="flex flex-col">
            {advice.steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                {/* Timeline */}
                <div className="flex flex-col items-center">
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-mono text-[11px] text-primary">
                    {i + 1}
                  </div>
                  {i < advice.steps.length - 1 && (
                    <div className="my-0.5 w-px flex-1 bg-border/40" style={{ minHeight: 16 }} />
                  )}
                </div>
                {/* Content */}
                <div className="mb-3 flex-1 min-w-0 pb-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{step.action}</span>
                    <span className="flex-shrink-0 font-mono text-[11px] text-muted-foreground">{step.time}</span>
                  </div>
                  {step.note && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rationale */}
      <div className="rounded-sm border border-border/40 bg-card/30 p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary/60" />
          <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Analysis</span>
        </div>
        <p className="text-xs leading-relaxed text-foreground/80">{advice.rationale}</p>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdvisorPage() {
  const [activeTab, setActiveTab] = useState<Tab>("deploy");
  const [deployResult, setDeployResult] = useState<DeployAdvice | null>(null);
  const [stakeResult,  setStakeResult]  = useState<StakeAdvice  | null>(null);
  const [bridgeResult, setBridgeResult] = useState<BridgeAdvice | null>(null);
  const [oracleGrounded, setOracleGrounded] = useState(false);

  const result = activeTab === "deploy" ? deployResult
               : activeTab === "stake"  ? stakeResult
               : bridgeResult;

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6">

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="mb-7 animate-slide-up">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-mono text-[11px] tracking-[0.3em] text-primary uppercase opacity-70">
              AI Ecosystem Navigator
            </span>
            <div className="h-px w-16 bg-primary/15" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">PulseAdvisor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI decisions grounded in PulseOracle on-chain snapshots + live cross-rollup data.
            Deploy, stake, or bridge with confidence.
          </p>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-3 gap-3 animate-slide-up delay-100">
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex flex-col gap-1 rounded-sm border p-3 text-left transition-all sm:p-4
                  ${active
                    ? "border-primary/40 bg-primary/[0.07]"
                    : "border-border/40 bg-card/30 hover:border-primary/20 hover:bg-primary/[0.03]"
                  }`}
              >
                <div className={`flex items-center gap-2 ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {tab.icon}
                  <span className="font-mono text-xs font-semibold tracking-wide">{tab.label}</span>
                </div>
                <p className="hidden text-[11px] text-muted-foreground sm:block">{tab.desc}</p>
              </button>
            );
          })}
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        <div className="animate-slide-up delay-200 grid gap-6 lg:grid-cols-2">
            {/* Form */}
            <div className="rounded-sm border border-border/50 bg-card/50 p-5 backdrop-blur-sm">
              <p className="mb-4 font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">
                {activeTab === "deploy" ? "Deployment requirements"
                 : activeTab === "stake"  ? "Staking parameters"
                 : "Bridge route"}
              </p>
              {activeTab === "deploy" && (
                <DeployForm onResult={(r, g) => { setDeployResult(r); setOracleGrounded(g); }} />
              )}
              {activeTab === "stake" && (
                <StakeForm onResult={(r, g) => { setStakeResult(r); setOracleGrounded(g); }} />
              )}
              {activeTab === "bridge" && (
                <BridgeForm onResult={(r, g) => { setBridgeResult(r); setOracleGrounded(g); }} />
              )}
            </div>

            {/* Result */}
            <div className="rounded-sm border border-border/40 bg-card/30 p-5 backdrop-blur-sm">
              {result ? (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">AI Recommendation</p>
                    <div className="flex items-center gap-3">
                      {oracleGrounded && (
                        <div className="flex items-center gap-1.5 rounded border border-primary/20 bg-primary/5 px-2 py-0.5">
                          <Database className="h-3 w-3 text-primary" />
                          <span className="font-mono text-[11px] text-primary">Oracle-grounded</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="font-mono text-[11px] text-emerald-400">Live data</span>
                      </div>
                    </div>
                  </div>
                  {activeTab === "deploy" && deployResult && <DeployResult advice={deployResult} />}
                  {activeTab === "stake"  && stakeResult  && <StakeResult  advice={stakeResult} />}
                  {activeTab === "bridge" && bridgeResult && <BridgeResult advice={bridgeResult} />}
                </>
              ) : (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/15 bg-primary/5">
                    {TABS.find(t => t.id === activeTab)?.icon && (
                      <span className="text-primary/40">
                        {TABS.find(t => t.id === activeTab)?.icon}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      Fill in the form and submit to get your
                    </p>
                    <p className="font-mono text-xs text-primary">
                      AI-powered recommendation
                    </p>
                  </div>
                  <div className="mt-2 rounded-sm border border-primary/10 bg-primary/[0.03] px-4 py-2">
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Grounded in PulseOracle on-chain snapshots + live rollup metrics
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

        {/* ── Footer note ───────────────────────────────────────────────── */}
        <div className="mt-6 animate-slide-up delay-300 flex items-start gap-2 rounded-sm border border-primary/10 bg-primary/[0.02] p-3">
          <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/40" />
          <p className="font-mono text-[11px] text-muted-foreground">
            PulseAdvisor uses live cross-rollup data aggregated by PulseOracle. Recommendations are AI-generated and
            do not constitute financial advice. Always do your own research before deploying capital or infrastructure.
          </p>
        </div>

      </main>
    </div>
  );
}
