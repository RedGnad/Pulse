"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Zap, Coins, ArrowLeftRight, Send, Vote,
  CheckCircle2, ShieldAlert, AlertTriangle, AlertCircle,
  ArrowRight, Loader2, Sparkles,
} from "lucide-react";
import { useEcosystem } from "@/hooks/use-ecosystem";
import { deriveRisks, risksForAction, Risk } from "@/lib/risks";
import { computePulseScore, scoreColor, scoreLabel } from "@/lib/pulse-score";
import { MinitiaWithMetrics } from "@/lib/types";

const MONO = "var(--font-jetbrains), monospace";
const SANS = "var(--font-chakra), sans-serif";

type Action = "bridge" | "stake" | "send" | "vote";

const ACTIONS: { id: Action; label: string; Icon: typeof Zap; desc: string }[] = [
  { id: "bridge", label: "Bridge",  Icon: ArrowLeftRight, desc: "Move assets between rollups or L1" },
  { id: "stake",  label: "Stake",   Icon: Coins,          desc: "Delegate INIT to a validator" },
  { id: "send",   label: "Send",    Icon: Send,           desc: "Transfer to another address" },
  { id: "vote",   label: "Vote",    Icon: Vote,           desc: "Cast a governance vote" },
];

export default function ActPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#5A7A8A", fontFamily: MONO, fontSize: 13 }}>Loading…</div>}>
      <ActPageInner />
    </Suspense>
  );
}

function ActPageInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { data: eco, isLoading } = useEcosystem();

  const [action, setAction] = useState<Action | null>((sp.get("action") as Action) ?? null);
  const [target, setTarget] = useState<string | null>(sp.get("target"));

  // Sync URL when state changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (target) params.set("target", target);
    const qs = params.toString();
    router.replace(qs ? `/act?${qs}` : "/act", { scroll: false });
  }, [action, target, router]);

  const minitias: MinitiaWithMetrics[] = useMemo(
    () => eco?.minitias.filter(m => !m.isMainnetRef) ?? [],
    [eco],
  );

  const scored = useMemo(() => {
    if (!eco) return [];
    return minitias.map(m => ({
      minitia: m,
      score: computePulseScore(m, minitias, eco.ibcChannels).total,
    })).sort((a, b) => b.score - a.score);
  }, [minitias, eco]);

  const allRisks = useMemo(() => (eco ? deriveRisks(eco) : []), [eco]);

  const targetMinitia = target ? minitias.find(m => m.chainId === target) : null;
  const targetScored = target ? scored.find(s => s.minitia.chainId === target) : null;

  if (isLoading || !eco) {
    return (
      <div style={{ padding: 40, display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 13, color: "#5A7A8A" }}>
        <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
        Loading ecosystem…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "40px 28px 80px" }}>

      {/* Hero */}
      <section style={{ marginBottom: 32 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#00FF88", padding: "5px 12px", borderRadius: 4,
          background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)",
          marginBottom: 16,
        }}>
          <Zap style={{ width: 12, height: 12 }} />
          Signal → Explanation → Action
        </div>
        <h1 style={{
          fontFamily: SANS, fontSize: 38, fontWeight: 800, color: "#E0F0FF",
          margin: "0 0 12px", letterSpacing: "-0.02em", lineHeight: 1.1,
        }}>
          What are you about to do?
        </h1>
        <p style={{ fontFamily: MONO, fontSize: 13, color: "#8AB4C8", margin: 0, lineHeight: 1.6, maxWidth: 680 }}>
          Pulse checks the specific route before you act. If the target rollup is
          degraded, you see why — and the action is flagged before you broadcast.
        </p>
      </section>

      {/* Combined picker — action + target on one screen */}
      <section style={{
        display: "grid", gridTemplateColumns: "260px 1fr", gap: 16,
        marginBottom: 24,
      }}>
        {/* Left: action column */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{
              width: 20, height: 20, borderRadius: "50%",
              border: "1px solid rgba(0,255,136,0.4)", background: "rgba(0,255,136,0.08)",
              color: "#00FF88", fontFamily: MONO, fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              1
            </span>
            <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: "#E0F0FF" }}>
              Action
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ACTIONS.map(a => {
              const isActive = action === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setAction(a.id)}
                  style={{
                    padding: "11px 13px",
                    borderRadius: 7,
                    border: isActive ? "1px solid rgba(0,255,136,0.4)" : "1px solid rgba(255,255,255,0.05)",
                    background: isActive ? "rgba(0,255,136,0.06)" : "rgba(10,18,24,0.5)",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 10,
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                >
                  <a.Icon style={{ width: 14, height: 14, color: isActive ? "#00FF88" : "#8AB4C8", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: SANS, fontSize: 12, fontWeight: 700,
                      color: isActive ? "#E0F0FF" : "#8AB4C8",
                    }}>
                      {a.label}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: "#5A7A8A", lineHeight: 1.4 }}>
                      {a.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: target column */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{
              width: 20, height: 20, borderRadius: "50%",
              border: action ? "1px solid rgba(0,255,136,0.4)" : "1px solid rgba(90,122,138,0.3)",
              background: action ? "rgba(0,255,136,0.08)" : "transparent",
              color: action ? "#00FF88" : "#5A7A8A",
              fontFamily: MONO, fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              2
            </span>
            <span style={{
              fontFamily: SANS, fontSize: 13, fontWeight: 700,
              color: action ? "#E0F0FF" : "#5A7A8A",
            }}>
              Target rollup
            </span>
            {!action && (
              <span style={{ fontFamily: MONO, fontSize: 10, color: "#5A7A8A", marginLeft: "auto" }}>
                pick an action first
              </span>
            )}
            {action && (
              <span style={{ fontFamily: MONO, fontSize: 10, color: "#5A7A8A", marginLeft: "auto" }}>
                sorted by pulse score
              </span>
            )}
          </div>
          <div style={{
            display: "flex", flexDirection: "column", gap: 5,
            opacity: action ? 1 : 0.4,
            pointerEvents: action ? "auto" : "none",
            transition: "opacity 0.2s",
          }}>
            {scored.map(({ minitia: m, score }) => {
              const isActive = target === m.chainId;
              const color = scoreColor(score);
              const label = scoreLabel(score);
              return (
                <button
                  key={m.chainId}
                  onClick={() => setTarget(m.chainId)}
                  style={{
                    padding: "11px 13px",
                    borderRadius: 6,
                    border: isActive ? `1px solid ${color}55` : "1px solid rgba(255,255,255,0.04)",
                    background: isActive ? `${color}10` : "rgba(10,18,24,0.5)",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 10,
                    textAlign: "left",
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", background: color,
                    boxShadow: `0 0 8px ${color}`, flexShrink: 0,
                  }} />
                  <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: "#E0F0FF", flex: 1 }}>
                    {m.prettyName ?? m.name}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: "#5A7A8A" }}>
                    {m.chainId}
                  </span>
                  <span style={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 700, color,
                    padding: "3px 8px", borderRadius: 3,
                    background: `${color}12`, border: `1px solid ${color}25`,
                    letterSpacing: "0.05em",
                  }}>
                    {label} · {score}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Target in URL that doesn't match any known rollup */}
      {action && target && !targetMinitia && (
        <section style={{
          padding: 16, marginBottom: 24,
          borderRadius: 8,
          border: "1px solid rgba(255,184,0,0.25)",
          background: "rgba(255,184,0,0.05)",
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <AlertCircle style={{ width: 18, height: 18, color: "#FFB800", flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: "#E0F0FF", marginBottom: 3 }}>
              Rollup <code style={{ color: "#FFB800" }}>{target}</code> is not in the Initia registry
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: "#8AB4C8", lineHeight: 1.6 }}>
              Pulse couldn&apos;t find this chain in the current snapshot. Pick a target from the list above, or reset the flow.
            </div>
          </div>
          <button
            onClick={() => setTarget(null)}
            style={{
              fontFamily: MONO, fontSize: 11, color: "#FFB800",
              background: "rgba(255,184,0,0.08)",
              border: "1px solid rgba(255,184,0,0.25)",
              borderRadius: 4, padding: "5px 10px", cursor: "pointer",
            }}
          >
            clear
          </button>
        </section>
      )}

      {/* Step 3 — verdict */}
      {action && target && targetMinitia && targetScored && (
        <Verdict
          action={action}
          minitia={targetMinitia}
          score={targetScored.score}
          risks={risksForAction(allRisks, action, target)}
          onReset={() => { setAction(null); setTarget(null); }}
        />
      )}
    </div>
  );
}

function Verdict({ action, minitia, score, risks, onReset }: {
  action: Action; minitia: MinitiaWithMetrics; score: number; risks: Risk[]; onReset: () => void;
}) {
  const critical = risks.filter(r => r.severity === "critical");
  const elevated = risks.filter(r => r.severity === "elevated");

  // Verdict rules: any critical → block; any elevated → warn; else allow
  const verdict: "allow" | "warn" | "block" =
    critical.length > 0 ? "block" :
    elevated.length > 0 ? "warn" :
    "allow";

  const META = {
    allow: { color: "#00FF88", Icon: CheckCircle2, label: "ALLOW", headline: "Route is clear" },
    warn:  { color: "#FFB800", Icon: ShieldAlert, label: "WARN",  headline: "Proceed with caution" },
    block: { color: "#FF3366", Icon: AlertTriangle, label: "BLOCK", headline: "Route is degraded — action blocked" },
  } as const;
  const meta = META[verdict];
  const { Icon } = meta;

  const askPrompt = buildAskPrompt(action, minitia, verdict);
  const askHref = `/ask?prompt=${encodeURIComponent(askPrompt)}`;

  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{
          width: 22, height: 22, borderRadius: "50%",
          border: `1px solid ${meta.color}55`, background: `${meta.color}12`,
          color: meta.color, fontFamily: MONO, fontSize: 11, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          3
        </span>
        <span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: "#E0F0FF" }}>
          Pulse verdict for this route
        </span>
        <button
          onClick={onReset}
          style={{
            marginLeft: "auto", fontFamily: MONO, fontSize: 11, color: "#5A7A8A",
            background: "none", border: "none", cursor: "pointer",
          }}
        >
          ← start over
        </button>
      </div>

      {/* Big verdict card */}
      <div style={{
        padding: 24, borderRadius: 10,
        border: `1px solid ${meta.color}40`,
        background: `linear-gradient(135deg, ${meta.color}10, rgba(4,10,15,0.6))`,
        marginBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <Icon style={{ width: 40, height: 40, color: meta.color }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SANS, fontSize: 26, fontWeight: 800, color: meta.color, lineHeight: 1.1 }}>
              {meta.headline}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: "#8AB4C8", marginTop: 5 }}>
              {action.toUpperCase()} · {minitia.prettyName ?? minitia.name} · pulse score {score}/100
            </div>
          </div>
          <span style={{
            fontFamily: MONO, fontSize: 11, fontWeight: 700, color: meta.color,
            padding: "5px 12px", borderRadius: 4,
            background: `${meta.color}15`, border: `1px solid ${meta.color}30`,
            letterSpacing: "0.1em",
          }}>
            {meta.label}
          </span>
        </div>

        {/* Risk list */}
        {risks.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {risks.map(r => (
              <RiskRow key={r.id} risk={r} />
            ))}
          </div>
        ) : (
          <div style={{ fontFamily: MONO, fontSize: 12, color: "#8AB4C8", lineHeight: 1.6 }}>
            No risks of type <strong style={{ color: "#E0F0FF" }}>{action}</strong> currently apply to this rollup. The specific route is safe.
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <Link href={askHref} style={{ flex: 1, textDecoration: "none" }}>
          <div style={{
            padding: "14px 18px", borderRadius: 8,
            border: verdict === "block" ? "1px solid rgba(255,51,102,0.25)" : "1px solid rgba(0,255,136,0.25)",
            background: verdict === "block" ? "rgba(255,51,102,0.05)" : "rgba(0,255,136,0.05)",
            display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
            opacity: verdict === "block" ? 0.5 : 1,
          }}>
            <Sparkles style={{ width: 16, height: 16, color: verdict === "block" ? "#FF3366" : "#00FF88" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: "#E0F0FF" }}>
                {verdict === "block" ? "Execution blocked" : "Execute via Ask Pulse"}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: "#8AB4C8", marginTop: 2 }}>
                {verdict === "block"
                  ? "Pulse will not pre-fill this action while the route is degraded."
                  : "Opens the chat with a pre-filled prompt, guarded by this verdict."}
              </div>
            </div>
            <ArrowRight style={{ width: 14, height: 14, color: "#8AB4C8" }} />
          </div>
        </Link>
      </div>
    </section>
  );
}

function RiskRow({ risk }: { risk: Risk }) {
  const color = risk.severity === "critical" ? "#FF3366"
              : risk.severity === "elevated" ? "#FFB800"
              : "#00D4FF";
  const Icon = risk.severity === "critical" ? AlertTriangle
             : risk.severity === "elevated" ? ShieldAlert
             : AlertCircle;
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 6,
      border: `1px solid ${color}20`, background: `${color}06`,
      display: "flex", alignItems: "flex-start", gap: 10,
    }}>
      <Icon style={{ width: 13, height: 13, color, flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: "#E0F0FF", marginBottom: 2 }}>
          {risk.headline}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: "#8AB4C8", lineHeight: 1.5 }}>
          {risk.detail}
        </div>
      </div>
    </div>
  );
}

function buildAskPrompt(action: Action, m: MinitiaWithMetrics, verdict: "allow" | "warn" | "block"): string {
  const name = m.prettyName ?? m.name;
  if (verdict === "block") {
    return `Pulse just blocked a ${action} to ${name} (${m.chainId}). Explain which specific risks caused the block.`;
  }
  switch (action) {
    case "bridge": return `I want to bridge to ${name} (${m.chainId}). The Pulse signal says ${verdict}. Walk me through the safest route.`;
    case "stake":  return `I want to stake on ${name} (${m.chainId}). The Pulse signal says ${verdict}. Which validator is safest right now?`;
    case "send":   return `I want to send tokens on ${name} (${m.chainId}). Confirm the chain is live and set up the transfer.`;
    case "vote":   return `Any active governance proposals on ${name} (${m.chainId}) I should vote on? Pulse says ${verdict}.`;
  }
}
