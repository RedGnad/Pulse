"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Zap, CheckCircle2, ShieldAlert, AlertTriangle,
  ArrowRight, Loader2, Sparkles, ExternalLink, Search,
} from "lucide-react";
import { useEcosystem } from "@/hooks/use-ecosystem";
import { deriveRisks, risksForAction, Risk } from "@/lib/risks";
import { computePulseScore, scoreColor, scoreLabel } from "@/lib/pulse-score";
import { computeL1Health, L1Health } from "@/lib/l1-health";
import {
  Action, Target, L1_ONLY_ACTIONS, buildTargets, parseIntent, inferAction,
} from "@/lib/action-routing";
import { MinitiaWithMetrics } from "@/lib/types";

const MONO = "var(--font-jetbrains), monospace";
const SANS = "var(--font-chakra), sans-serif";

// Curated demo intents — each produces a non-trivial routing decision.
const FEATURED_INTENTS = [
  "borrow USDC",
  "trade ETH perps with leverage",
  "delta neutral vault for INIT",
  "mint NFTs on Initia",
  "play a game on Initia",
  "stake INIT",
];

const ACTION_LABELS: Record<Action, string> = {
  bridge: "Bridge",
  trade: "DeFi",
  play: "Gaming",
  mint: "NFT",
  send: "Send",
  stake: "Staking",
  vote: "Governance",
};

function risksActionKey(action: Action): "bridge" | "stake" | "send" | "vote" {
  if (action === "stake" || action === "vote" || action === "send" || action === "bridge") return action;
  return "bridge";
}

export default function ActPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#5A7A8A", fontFamily: MONO, fontSize: 13 }}>Loading…</div>}>
      <ActPageInner />
    </Suspense>
  );
}

function useIsNarrow(bp = 900): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [bp]);
  return narrow;
}

// ─── Main page ──────────────────────────────────────────────────────────────

function ActPageInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { data: eco, isLoading } = useEcosystem();
  const isNarrow = useIsNarrow(900);

  const [intentText, setIntentText] = useState(sp.get("intent") ?? "");

  // Sync intent to URL — lightweight, no other params needed
  useEffect(() => {
    const params = new URLSearchParams();
    if (intentText.trim()) params.set("intent", intentText.trim());
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }, [intentText, router]);

  const action = useMemo(() => inferAction(intentText), [intentText]);

  const parsedIntent = useMemo(() => {
    if (!action || !intentText.trim()) return null;
    const p = parseIntent(intentText, action);
    if (!p.verbs.length && !p.assets.length && !p.modifiers.length) return null;
    return p;
  }, [action, intentText]);

  const scoredRollups = useMemo(() => {
    if (!eco) return [];
    return eco.minitias
      .filter(m => (m.metrics?.blockHeight ?? 0) > 0 || m.profile)
      .map(m => {
        const total = computePulseScore(m, eco.minitias, eco.ibcChannels).total;
        return { minitia: m, score: total, color: scoreColor(total), label: scoreLabel(total) };
      })
      .sort((a, b) => b.score - a.score);
  }, [eco]);

  const l1Health = useMemo(() => (eco ? computeL1Health(eco.l1) : null), [eco]);

  const targets = useMemo(() => {
    if (!eco || !l1Health || !action) return [];
    return buildTargets(action, eco, l1Health, scoredRollups, parsedIntent);
  }, [action, eco, l1Health, scoredRollups, parsedIntent]);

  const allRisks = useMemo(() => (eco ? deriveRisks(eco) : []), [eco]);

  if (isLoading || !eco) {
    return (
      <div style={{ padding: 40, display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 13, color: "#5A7A8A" }}>
        <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
        Loading ecosystem…
      </div>
    );
  }

  const hasResults = !!action && targets.length > 0;
  const topTarget = hasResults ? targets[0] : null;
  const otherTargets = hasResults ? targets.slice(1) : [];

  // Ecosystem stats for the landing
  const defiCount = scoredRollups.filter(r => r.minitia.profile?.category === "DeFi").length;
  const gamingCount = scoredRollups.filter(r => r.minitia.profile?.category === "Gaming").length;
  const nftCount = scoredRollups.filter(r => r.minitia.profile?.category === "NFT").length;

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: isNarrow ? "24px 16px 60px" : "40px 28px 80px" }}>

      {/* ── Hero ── */}
      <section style={{ marginBottom: hasResults ? 36 : 0 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#00FF88", padding: "5px 12px", borderRadius: 4,
          background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)",
          marginBottom: 16,
        }}>
          <Zap style={{ width: 12, height: 12 }} />
          Intent Router
        </div>

        <h1 style={{
          fontFamily: SANS, fontSize: isNarrow ? 30 : 44, fontWeight: 800, color: "#E0F0FF",
          margin: "0 0 12px", letterSpacing: "-0.03em", lineHeight: 1.05,
        }}>
          What do you want to do{" "}
          <span className="pulse-gradient-text" style={{
            backgroundImage: "linear-gradient(90deg, #00FF88, #00D4FF, #A78BFA, #00FF88)",
          }}>
            on Initia?
          </span>
        </h1>

        <p style={{
          fontFamily: MONO, fontSize: 13, color: "#8AB4C8", margin: "0 0 20px",
          lineHeight: 1.6, maxWidth: 620,
        }}>
          Describe your intent — Pulse identifies the right appchain, checks
          live risk, and routes you directly.
        </p>

        {/* ── Search input ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 16px",
          borderRadius: 10,
          border: `1px solid ${action ? "rgba(0,255,136,0.35)" : "rgba(0,212,255,0.18)"}`,
          background: action ? "rgba(0,255,136,0.04)" : "rgba(0,212,255,0.03)",
          transition: "all 0.25s",
          boxShadow: action ? "0 0 30px rgba(0,255,136,0.06)" : "none",
        }}>
          {action ? (
            <Sparkles style={{ width: 16, height: 16, color: "#00FF88", flexShrink: 0 }} />
          ) : (
            <Search style={{ width: 16, height: 16, color: "#5A7A8A", flexShrink: 0 }} />
          )}
          <input
            type="text"
            value={intentText}
            onChange={e => setIntentText(e.target.value)}
            placeholder="borrow USDC · trade ETH perps · play a game · stake INIT…"
            autoFocus
            style={{
              flex: 1, minWidth: 0,
              background: "transparent",
              border: "none", outline: "none",
              fontFamily: MONO, fontSize: 13,
              color: "#E0F0FF",
            }}
          />
          {action && (
            <span style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700,
              color: "#00FF88", letterSpacing: "0.08em",
              padding: "3px 8px", borderRadius: 3,
              background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)",
              flexShrink: 0,
            }}>
              {ACTION_LABELS[action]}
            </span>
          )}
          {intentText && (
            <button
              onClick={() => setIntentText("")}
              style={{
                fontFamily: MONO, fontSize: 10, color: "#5A7A8A",
                background: "transparent", border: "none", cursor: "pointer",
                padding: "2px 6px", flexShrink: 0,
              }}
            >
              clear
            </button>
          )}
        </div>

        {/* ── Demo chips ── */}
        {!intentText && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 8,
            marginTop: 14,
          }}>
            <span style={{
              fontFamily: MONO, fontSize: 10,
              color: "#5A7A8A", letterSpacing: "0.08em", textTransform: "uppercase",
              alignSelf: "center", marginRight: 2,
            }}>
              try:
            </span>
            {FEATURED_INTENTS.map(text => (
              <button
                key={text}
                onClick={() => setIntentText(text)}
                style={{
                  fontFamily: MONO, fontSize: 11,
                  color: "#8AB4C8",
                  padding: "6px 12px",
                  borderRadius: 5,
                  background: "rgba(0,212,255,0.04)",
                  border: "1px solid rgba(0,212,255,0.14)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(0,212,255,0.10)";
                  e.currentTarget.style.color = "#E0F0FF";
                  e.currentTarget.style.borderColor = "rgba(0,212,255,0.30)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(0,212,255,0.04)";
                  e.currentTarget.style.color = "#8AB4C8";
                  e.currentTarget.style.borderColor = "rgba(0,212,255,0.14)";
                }}
              >
                {text}
              </button>
            ))}
          </div>
        )}

        {/* ── Ecosystem stats (landing) ── */}
        {!intentText && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20,
            fontFamily: MONO, fontSize: 11, color: "#5A7A8A",
          }}>
            {defiCount > 0 && <StatChip label="DeFi" count={defiCount} color="#00D4FF" />}
            {gamingCount > 0 && <StatChip label="Gaming" count={gamingCount} color="#A78BFA" />}
            {nftCount > 0 && <StatChip label="NFT" count={nftCount} color="#FFB800" />}
            <span style={{ alignSelf: "center", color: "#3A5A6A" }}>
              — ranked by live health, matched by intent
            </span>
          </div>
        )}

        {/* ── Parsed intent tokens ── */}
        {parsedIntent && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6,
            marginTop: 10, fontFamily: MONO, fontSize: 10,
          }}>
            <span style={{ color: "#5A7A8A", letterSpacing: "0.08em", textTransform: "uppercase", alignSelf: "center" }}>
              parsed:
            </span>
            {parsedIntent.verbs.map(v => (
              <span key={`v-${v}`} style={{
                color: "#00FF88", padding: "2px 7px", borderRadius: 3,
                background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.18)",
              }}>{v}</span>
            ))}
            {parsedIntent.assets.map(a => (
              <span key={`a-${a}`} style={{
                color: "#00D4FF", padding: "2px 7px", borderRadius: 3,
                background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.18)",
              }}>{a.toUpperCase()}</span>
            ))}
            {parsedIntent.modifiers.map(m => (
              <span key={`m-${m}`} style={{
                color: "#A78BFA", padding: "2px 7px", borderRadius: 3,
                background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.18)",
              }}>{m}</span>
            ))}
          </div>
        )}

        {/* ── Vague intent hint ── */}
        {intentText.trim() && !action && (
          <div style={{
            marginTop: 14, padding: "10px 14px", borderRadius: 6,
            border: "1px solid rgba(0,212,255,0.15)", background: "rgba(0,212,255,0.04)",
            fontFamily: MONO, fontSize: 11, color: "#8AB4C8", lineHeight: 1.5,
          }}>
            <Search style={{ width: 12, height: 12, color: "#00D4FF", verticalAlign: -2, marginRight: 6 }} />
            Try a specific action — <em style={{ color: "#E0F0FF" }}>borrow</em>,{" "}
            <em style={{ color: "#E0F0FF" }}>trade</em>,{" "}
            <em style={{ color: "#E0F0FF" }}>stake</em>,{" "}
            <em style={{ color: "#E0F0FF" }}>play</em>,{" "}
            or <em style={{ color: "#E0F0FF" }}>mint</em>.
          </div>
        )}
      </section>

      {/* ── Results ── */}
      {hasResults && action && (
        <section>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
          }}>
            <span style={{
              fontFamily: SANS, fontSize: 15, fontWeight: 700, color: "#E0F0FF",
            }}>
              {targets.length === 1 ? "1 match" : `${targets.length} matches`}
            </span>
            <span style={{
              fontFamily: MONO, fontSize: 10, color: "#5A7A8A",
              marginLeft: "auto",
            }}>
              ranked by intent match + live health
            </span>
          </div>

          {/* L1-only info banner */}
          {L1_ONLY_ACTIONS.has(action) && (
            <div style={{
              marginBottom: 12, padding: "10px 14px", borderRadius: 6,
              border: "1px solid rgba(0,212,255,0.18)", background: "rgba(0,212,255,0.04)",
              fontFamily: MONO, fontSize: 11, color: "#8AB4C8", lineHeight: 1.5,
            }}>
              <strong style={{ color: "#E0F0FF" }}>
                {action === "stake" ? "Staking" : "Governance"} happens on Initia L1.
              </strong>{" "}
              Minitias are OPinit rollups with a single operator — no bonded validators, no gov module.
            </div>
          )}

          {/* Top recommendation */}
          {topTarget && (
            <HeroCard
              target={topTarget}
              action={action}
              risks={topTarget.kind === "rollup"
                ? risksForAction(allRisks, risksActionKey(action), topTarget.chainId)
                : []}
              isNarrow={isNarrow}
            />
          )}

          {/* Other results */}
          {otherTargets.map((t, i) => (
            <CompactCard
              key={t.chainId}
              target={t}
              action={action}
              risks={t.kind === "rollup"
                ? risksForAction(allRisks, risksActionKey(action), t.chainId)
                : []}
              rank={i + 2}
            />
          ))}
        </section>
      )}

      {/* No matches */}
      {action && targets.length === 0 && (
        <div style={{
          marginTop: 16, padding: "14px 16px", borderRadius: 8,
          border: "1px solid rgba(255,184,0,0.25)", background: "rgba(255,184,0,0.05)",
          fontFamily: MONO, fontSize: 11, color: "#8AB4C8", lineHeight: 1.6,
        }}>
          <strong style={{ color: "#E0F0FF" }}>No chains match this intent.</strong>{" "}
          You may be on testnet. Switch to mainnet in the header to see live appchains.
        </div>
      )}
    </div>
  );
}

// ─── Stat chip (landing) ────────────────────────────────────────────────────

function StatChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 4,
      border: `1px solid ${color}25`, background: `${color}08`,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", background: color,
        boxShadow: `0 0 6px ${color}`,
      }} />
      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color }}>
        {count}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 10, color: "#8AB4C8" }}>
        {label}
      </span>
    </span>
  );
}

// ─── Category badge ─────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  const palette: Record<string, string> = {
    "L1":     "#00FF88",
    "DeFi":   "#00D4FF",
    "Gaming": "#A78BFA",
    "NFT":    "#FFB800",
  };
  const color = palette[category] ?? "#5A7A8A";
  return (
    <span style={{
      fontFamily: MONO, fontSize: 9, fontWeight: 700,
      color, letterSpacing: "0.08em",
      padding: "2px 6px", borderRadius: 2,
      background: `${color}12`, border: `1px solid ${color}28`,
    }}>
      {category.toUpperCase()}
    </span>
  );
}

// ─── Hero card (top recommendation) ─────────────────────────────────────────

function HeroCard({ target, action, risks, isNarrow }: {
  target: Target;
  action: Action;
  risks: Risk[];
  isNarrow: boolean;
}) {
  const verdict = computeVerdict(target, risks);
  const vm = VERDICT_META[verdict];

  const minitia = target.kind === "rollup" ? target.minitia : undefined;
  const website = minitia?.profile?.website;
  const isRollupExecution = action === "trade" || action === "play" || action === "mint";
  const externalHref = isRollupExecution && website && verdict !== "block" ? website : undefined;

  const askHref = buildAskHref(target, action, verdict);

  return (
    <div style={{
      marginBottom: 12,
      borderRadius: 12,
      border: `1px solid ${vm.color}35`,
      background: `linear-gradient(135deg, ${vm.color}0C, rgba(4,10,15,0.6))`,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: isNarrow ? "16px 16px 12px" : "20px 24px 16px" }}>
        {/* Top row: verdict + score */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontFamily: MONO, fontSize: 10, fontWeight: 700, color: vm.color,
            padding: "3px 8px", borderRadius: 3,
            background: `${vm.color}12`, border: `1px solid ${vm.color}30`,
            letterSpacing: "0.06em",
          }}>
            <vm.Icon style={{ width: 11, height: 11 }} />
            {vm.label}
          </span>
          <span style={{
            fontFamily: MONO, fontSize: 10, color: "#5A7A8A",
          }}>
            #1 recommendation
          </span>
          <span style={{
            marginLeft: "auto",
            fontFamily: MONO, fontSize: 11, fontWeight: 700, color: target.color,
            padding: "3px 8px", borderRadius: 3,
            background: `${target.color}12`, border: `1px solid ${target.color}25`,
          }}>
            {target.label} · {target.score}
          </span>
        </div>

        {/* Name + category */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 6,
          flexWrap: "wrap",
        }}>
          <span style={{
            fontFamily: SANS, fontSize: isNarrow ? 22 : 26, fontWeight: 800,
            color: "#E0F0FF", lineHeight: 1.1,
          }}>
            {target.name}
          </span>
          {target.category && <CategoryBadge category={target.category} />}
          <span style={{ fontFamily: MONO, fontSize: 10, color: "#3A5A6A" }}>
            {target.chainId}
          </span>
        </div>

        {/* Description */}
        {target.description && (
          <div style={{
            fontFamily: MONO, fontSize: 12, color: "#8AB4C8",
            lineHeight: 1.5, marginBottom: 10, maxWidth: 600,
          }}>
            {target.description}
          </div>
        )}

        {/* Reasoning badges */}
        {target.reasoning && target.reasoning.facts.length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6,
            alignItems: "center",
          }}>
            {target.reasoning.facts
              .filter(f => f.kind !== "info")
              .slice(0, 6)
              .map((f, i) => (
              <span key={i} style={{
                fontFamily: MONO, fontSize: 9,
                color: f.kind === "pass" ? "#00FF88" : "#FF3366",
                padding: "2px 6px", borderRadius: 2,
                background: f.kind === "pass" ? "rgba(0,255,136,0.06)" : "rgba(255,51,102,0.06)",
                border: `1px solid ${f.kind === "pass" ? "rgba(0,255,136,0.18)" : "rgba(255,51,102,0.18)"}`,
              }}>
                {f.kind === "pass" ? "✓" : "✗"} {f.label}
              </span>
            ))}
            {target.reasoning.intentMatch > 0 && (
              <span style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: "#A78BFA",
                padding: "2px 7px", borderRadius: 2,
                background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.18)",
                marginLeft: "auto",
              }}>
                intent match {target.reasoning.intentMatch}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Risk detail + L1 metrics */}
      <div style={{
        padding: isNarrow ? "0 16px 16px" : "0 24px 20px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        paddingTop: 14,
      }}>
        {/* L1 metrics */}
        {target.kind === "l1" && (
          <div style={{
            display: "grid",
            gridTemplateColumns: isNarrow ? "1fr 1fr" : "repeat(3, 1fr)",
            gap: 8, marginBottom: 12,
          }}>
            <L1Metric label="Validators" value={String(target.health.validators)} color="#00D4FF" />
            <L1Metric
              label="Last block"
              value={target.health.blockAgeSec >= 0 ? `${Math.round(target.health.blockAgeSec)}s ago` : "—"}
              color={target.health.blockAgeSec < 60 ? "#00FF88" : target.health.blockAgeSec < 300 ? "#FFB800" : "#FF3366"}
            />
            <L1Metric
              label="Active proposals"
              value={String(target.health.activeProposals)}
              color={target.health.activeProposals > 0 ? "#A78BFA" : "#5A7A8A"}
            />
          </div>
        )}

        {/* Risks */}
        {risks.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {risks.map(r => <RiskRow key={r.id} risk={r} />)}
          </div>
        ) : (
          <div style={{
            fontFamily: MONO, fontSize: 11, color: "#5A7A8A",
            marginBottom: 14,
          }}>
            {target.kind === "l1" && action === "vote" && target.health.activeProposals === 0
              ? "L1 is healthy but there are no active governance proposals right now."
              : "No risks apply to this route."}
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {externalHref && (
            <a
              href={externalHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: "1 1 220px", textDecoration: "none" }}
            >
              <div style={{
                padding: "13px 16px", borderRadius: 8,
                border: `1px solid ${vm.color}50`,
                background: `linear-gradient(135deg, ${vm.color}15, ${vm.color}06)`,
                display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer",
                boxShadow: `0 0 20px ${vm.color}12`,
                transition: "box-shadow 0.2s",
              }}>
                <ExternalLink style={{ width: 15, height: 15, color: vm.color }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: "#E0F0FF" }}>
                    Open {target.name}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "#8AB4C8", marginTop: 1 }}>
                    {new URL(externalHref).hostname}
                  </div>
                </div>
                <ArrowRight style={{ width: 14, height: 14, color: vm.color }} />
              </div>
            </a>
          )}
          <Link href={askHref} style={{ flex: "1 1 220px", textDecoration: "none" }}>
            <div style={{
              padding: "13px 16px", borderRadius: 8,
              border: verdict === "block"
                ? "1px solid rgba(255,51,102,0.25)"
                : externalHref
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(0,255,136,0.25)",
              background: verdict === "block"
                ? "rgba(255,51,102,0.05)"
                : externalHref
                ? "rgba(10,18,24,0.6)"
                : "rgba(0,255,136,0.05)",
              display: "flex", alignItems: "center", gap: 10,
              cursor: verdict === "block" ? "not-allowed" : "pointer",
              opacity: verdict === "block" ? 0.5 : 1,
            }}>
              <Sparkles style={{
                width: 15, height: 15,
                color: verdict === "block" ? "#FF3366" : externalHref ? "#8AB4C8" : "#00FF88",
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: "#E0F0FF" }}>
                  {verdict === "block" ? "Route blocked" : "Ask Pulse"}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: "#8AB4C8", marginTop: 1 }}>
                  {verdict === "block" ? "Risks must clear first" : "Detailed analysis + execution help"}
                </div>
              </div>
              <ArrowRight style={{ width: 14, height: 14, color: "#8AB4C8" }} />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Compact card (results 2+) ──────────────────────────────────────────────

function CompactCard({ target, action, risks, rank }: {
  target: Target;
  action: Action;
  risks: Risk[];
  rank: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const verdict = computeVerdict(target, risks);
  const vm = VERDICT_META[verdict];

  const minitia = target.kind === "rollup" ? target.minitia : undefined;
  const website = minitia?.profile?.website;
  const isRollupExecution = action === "trade" || action === "play" || action === "mint";
  const externalHref = isRollupExecution && website && verdict !== "block" ? website : undefined;

  const askHref = buildAskHref(target, action, verdict);

  return (
    <div style={{
      marginBottom: 8,
      borderRadius: 10,
      border: expanded ? `1px solid ${vm.color}25` : "1px solid rgba(255,255,255,0.06)",
      background: expanded ? `${vm.color}04` : "rgba(10,18,24,0.5)",
      overflow: "hidden",
      transition: "all 0.2s",
    }}>
      {/* Clickable header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", padding: "14px 18px",
          display: "flex", alignItems: "center", gap: 12,
          cursor: "pointer",
          background: "transparent", border: "none", textAlign: "left",
        }}
      >
        {/* Rank */}
        <span style={{
          fontFamily: MONO, fontSize: 11, fontWeight: 700, color: "#3A5A6A",
          width: 22, textAlign: "center", flexShrink: 0,
        }}>
          {rank}
        </span>

        {/* Verdict dot */}
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: vm.color, boxShadow: `0 0 6px ${vm.color}`,
          flexShrink: 0,
        }} />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: "#E0F0FF" }}>
              {target.name}
            </span>
            {target.category && <CategoryBadge category={target.category} />}
            {target.reasoning && target.reasoning.intentMatch > 0 && (
              <span style={{
                fontFamily: MONO, fontSize: 9, color: "#A78BFA",
                padding: "1px 5px", borderRadius: 2,
                background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)",
              }}>
                intent {target.reasoning.intentMatch}
              </span>
            )}
          </div>
          {target.description && (
            <div style={{
              fontFamily: MONO, fontSize: 10, color: "#5A7A8A",
              marginTop: 3, lineHeight: 1.4,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {target.description}
            </div>
          )}
        </div>

        {/* Score */}
        <span style={{
          fontFamily: MONO, fontSize: 10, fontWeight: 700, color: target.color,
          padding: "3px 8px", borderRadius: 3,
          background: `${target.color}12`, border: `1px solid ${target.color}25`,
          flexShrink: 0,
        }}>
          {target.score}
        </span>

        {/* Quick CTA */}
        {externalHref ? (
          <a
            href={externalHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700, color: "#00FF88",
              padding: "5px 10px", borderRadius: 4,
              background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.2)",
              textDecoration: "none",
              display: "flex", alignItems: "center", gap: 4,
              flexShrink: 0,
            }}
          >
            Open <ExternalLink style={{ width: 10, height: 10 }} />
          </a>
        ) : (
          <Link
            href={askHref}
            onClick={e => e.stopPropagation()}
            style={{
              fontFamily: MONO, fontSize: 10, color: "#8AB4C8",
              padding: "5px 10px", borderRadius: 4,
              background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)",
              textDecoration: "none",
              display: "flex", alignItems: "center", gap: 4,
              flexShrink: 0,
            }}
          >
            <Sparkles style={{ width: 10, height: 10 }} /> Ask
          </Link>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          padding: "0 18px 16px", paddingLeft: 60,
          borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 12,
        }}>
          {/* Reasoning badges */}
          {target.reasoning && target.reasoning.facts.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
              {target.reasoning.facts
                .filter(f => f.kind !== "info")
                .slice(0, 6)
                .map((f, i) => (
                <span key={i} style={{
                  fontFamily: MONO, fontSize: 9,
                  color: f.kind === "pass" ? "#00FF88" : "#FF3366",
                  padding: "2px 6px", borderRadius: 2,
                  background: f.kind === "pass" ? "rgba(0,255,136,0.06)" : "rgba(255,51,102,0.06)",
                  border: `1px solid ${f.kind === "pass" ? "rgba(0,255,136,0.18)" : "rgba(255,51,102,0.18)"}`,
                }}>
                  {f.kind === "pass" ? "✓" : "✗"} {f.label}
                </span>
              ))}
            </div>
          )}

          {/* Risks */}
          {risks.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {risks.map(r => <RiskRow key={r.id} risk={r} />)}
            </div>
          )}

          {/* Full CTAs */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {externalHref && (
              <a href={externalHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <div style={{
                  padding: "8px 14px", borderRadius: 6,
                  border: "1px solid rgba(0,255,136,0.3)", background: "rgba(0,255,136,0.06)",
                  display: "flex", alignItems: "center", gap: 6,
                  fontFamily: MONO, fontSize: 11, fontWeight: 700, color: "#00FF88",
                }}>
                  Open {target.name} <ExternalLink style={{ width: 11, height: 11 }} />
                </div>
              </a>
            )}
            <Link href={askHref} style={{ textDecoration: "none" }}>
              <div style={{
                padding: "8px 14px", borderRadius: 6,
                border: "1px solid rgba(0,212,255,0.15)", background: "rgba(0,212,255,0.04)",
                display: "flex", alignItems: "center", gap: 6,
                fontFamily: MONO, fontSize: 11, color: "#8AB4C8",
              }}>
                <Sparkles style={{ width: 11, height: 11 }} /> Ask Pulse
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

const VERDICT_META = {
  allow: { color: "#00FF88", Icon: CheckCircle2, label: "ROUTE CLEAR" },
  warn:  { color: "#FFB800", Icon: ShieldAlert,  label: "CAUTION" },
  block: { color: "#FF3366", Icon: AlertTriangle, label: "BLOCKED" },
} as const;

function computeVerdict(target: Target, risks: Risk[]): "allow" | "warn" | "block" {
  if (target.kind === "l1") {
    return target.health.score < 25 ? "block" : target.health.score < 50 ? "warn" : "allow";
  }
  const critical = risks.filter(r => r.severity === "critical");
  const elevated = risks.filter(r => r.severity === "elevated");
  return critical.length > 0 ? "block" : elevated.length > 0 ? "warn" : "allow";
}

function buildAskHref(target: Target, action: Action, verdict: "allow" | "warn" | "block"): string {
  const prompt = target.kind === "rollup"
    ? buildAskPromptRollup(action, target.minitia, verdict)
    : buildAskPromptL1(action, target.chainId, verdict);
  return `/ask?prompt=${encodeURIComponent(prompt)}`;
}

function L1Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 6,
      border: "1px solid rgba(255,255,255,0.05)",
      background: "rgba(10,18,24,0.5)",
    }}>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5A7A8A" }}>
        {label}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, color, marginTop: 3, lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  );
}

function RiskRow({ risk }: { risk: Risk }) {
  const color = risk.severity === "critical" ? "#FF3366"
              : risk.severity === "elevated" ? "#FFB800"
              : "#00D4FF";
  const Icon = risk.severity === "critical" ? AlertTriangle
             : risk.severity === "elevated" ? ShieldAlert
             : CheckCircle2;
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

function buildAskPromptRollup(action: Action, m: MinitiaWithMetrics, verdict: "allow" | "warn" | "block"): string {
  const name = m.prettyName ?? m.name;
  if (verdict === "block") {
    return `Pulse just blocked a ${action} on ${name} (${m.chainId}). Explain which specific risks caused the block.`;
  }
  switch (action) {
    case "bridge": return `I want to bridge to ${name} (${m.chainId}). The Pulse signal says ${verdict}. Walk me through the safest route.`;
    case "trade":  return `I want to trade on ${name} (${m.chainId}). Pulse says ${verdict}. What's the current state of the rollup and what can I do there?`;
    case "play":   return `I want to interact with ${name} (${m.chainId}). Pulse says ${verdict}. What's live on this rollup right now?`;
    case "mint":   return `I want to mint or trade NFTs on ${name} (${m.chainId}). Pulse says ${verdict}. Is the launchpad live?`;
    case "send":   return `I want to send tokens on ${name} (${m.chainId}). Confirm the chain is live and set up the transfer.`;
    case "stake":  return `I want to stake on ${name} (${m.chainId}). Pulse says ${verdict}.`;
    case "vote":   return `Any active governance proposals on ${name} (${m.chainId}) I should vote on? Pulse says ${verdict}.`;
  }
}

function buildAskPromptL1(action: Action, chainId: string, verdict: "allow" | "warn" | "block"): string {
  if (verdict === "block") {
    return `Pulse just blocked a ${action} on Initia L1 (${chainId}). Which L1 issue triggered it?`;
  }
  switch (action) {
    case "stake":  return `I want to stake INIT on Initia L1 (${chainId}). Pulse says ${verdict}. Which validator is the safest pick right now?`;
    case "vote":   return `Show me the active governance proposals on Initia L1 (${chainId}) and tell me which way the ecosystem is leaning.`;
    case "bridge": return `I want to bridge to Initia L1 (${chainId}). Pulse says ${verdict}. What's the safest route in?`;
    case "send":   return `I want to send tokens on Initia L1 (${chainId}). Confirm the chain is live and set up the transfer.`;
    case "trade":
    case "play":
    case "mint":
      return `${action.toUpperCase()} isn't a native L1 action — walk me through what I should do instead on Initia.`;
  }
}
