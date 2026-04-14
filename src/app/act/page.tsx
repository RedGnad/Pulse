"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Zap, Coins, ArrowLeftRight, Send, Vote, Gamepad2, Palette, TrendingUp,
  CheckCircle2, ShieldAlert, AlertTriangle, AlertCircle,
  ArrowRight, Loader2, Sparkles, Info,
} from "lucide-react";
import { useEcosystem } from "@/hooks/use-ecosystem";
import { deriveRisks, risksForAction, Risk } from "@/lib/risks";
import { computePulseScore, scoreColor, scoreLabel } from "@/lib/pulse-score";
import { computeL1Health, L1Health } from "@/lib/l1-health";
import {
  Action, Target, L1_ONLY_ACTIONS, buildTargets, parseIntent,
} from "@/lib/action-routing";
import { MinitiaWithMetrics } from "@/lib/types";

const MONO = "var(--font-jetbrains), monospace";
const SANS = "var(--font-chakra), sans-serif";

const ACTIONS: { id: Action; label: string; Icon: typeof Zap; desc: string }[] = [
  { id: "bridge", label: "Bridge", Icon: ArrowLeftRight, desc: "Move assets between rollups or L1" },
  { id: "trade",  label: "Trade",  Icon: TrendingUp,     desc: "Swap, perps, lend on a DeFi rollup" },
  { id: "play",   label: "Play",   Icon: Gamepad2,       desc: "Interact with a gaming rollup" },
  { id: "mint",   label: "Mint",   Icon: Palette,        desc: "Mint or trade NFTs on a launchpad" },
  { id: "send",   label: "Send",   Icon: Send,           desc: "Transfer to another address" },
  { id: "stake",  label: "Stake",  Icon: Coins,          desc: "Delegate INIT to a validator (L1)" },
  { id: "vote",   label: "Vote",   Icon: Vote,           desc: "Cast a governance vote (L1)" },
];

// Maps for the risksForAction filter (which only knows the legacy rollup
// action vocabulary: bridge/stake/send/vote). Trade/Play/Mint on rollups
// are all "touch the rollup's state machine", so they inherit bridge-class
// risks (route degradation, stale data, no IBC path).
function risksActionKey(action: Action): "bridge" | "stake" | "send" | "vote" {
  if (action === "stake" || action === "vote" || action === "send" || action === "bridge") return action;
  return "bridge"; // trade, play, mint → treated like bridge for risk filtering
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

function ActPageInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { data: eco, isLoading } = useEcosystem();
  const isNarrow = useIsNarrow(900);

  const [action, setAction] = useState<Action | null>((sp.get("action") as Action) ?? null);
  const [target, setTarget] = useState<string | null>(sp.get("target"));
  const [intentText, setIntentText] = useState<string>(sp.get("intent") ?? "");

  useEffect(() => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (target) params.set("target", target);
    if (intentText.trim()) params.set("intent", intentText.trim());
    const qs = params.toString();
    router.replace(qs ? `/act?${qs}` : "/act", { scroll: false });
  }, [action, target, intentText, router]);

  // Parse the free-text intent whenever it or the action changes. Memoised so
  // buildTargets doesn't re-score on every keystroke re-render.
  const parsedIntent = useMemo(() => {
    if (!action || !intentText.trim()) return null;
    const p = parseIntent(intentText, action);
    // If nothing got extracted, treat as "no intent" — falls back to pure
    // live-health sort, which is the honest default.
    if (!p.verbs.length && !p.assets.length && !p.modifiers.length) return null;
    return p;
  }, [action, intentText]);

  // Score every rollup once (including mainnet app-chains shown as refs, so
  // users can pick them for Trade/Play/Mint actions).
  const scoredRollups = useMemo(() => {
    if (!eco) return [];
    const all = eco.minitias.filter(m => (m.metrics?.blockHeight ?? 0) > 0 || m.profile);
    return all
      .map(m => {
        const total = computePulseScore(m, eco.minitias, eco.ibcChannels).total;
        return { minitia: m, score: total, color: scoreColor(total), label: scoreLabel(total) };
      })
      .sort((a, b) => b.score - a.score);
  }, [eco]);

  const l1Health = useMemo(() => (eco ? computeL1Health(eco.l1) : null), [eco]);

  const targets = useMemo(() => {
    if (!eco || !l1Health) return [];
    return buildTargets(action, eco, l1Health, scoredRollups, parsedIntent);
  }, [action, eco, l1Health, scoredRollups, parsedIntent]);

  const selectedTarget = target ? targets.find(t => t.chainId === target) ?? null : null;
  const allRisks = useMemo(() => (eco ? deriveRisks(eco) : []), [eco]);

  // If the current target becomes invalid for the new action, clear it.
  useEffect(() => {
    if (!action || !target) return;
    const stillValid = targets.some(t => t.chainId === target);
    if (!stillValid) setTarget(null);
  }, [action, target, targets]);

  if (isLoading || !eco) {
    return (
      <div style={{ padding: 40, display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 13, color: "#5A7A8A" }}>
        <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
        Loading ecosystem…
      </div>
    );
  }

  const l1OnlyAction = action && L1_ONLY_ACTIONS.has(action);
  const rollupTargetCount = targets.filter(t => t.kind === "rollup").length;
  const noRollupsForAction = !!action && !l1OnlyAction && rollupTargetCount === 0;

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "40px 28px 80px" }}>

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
        <p style={{ fontFamily: MONO, fontSize: 13, color: "#8AB4C8", margin: "0 0 18px", lineHeight: 1.6, maxWidth: 680 }}>
          Pick an action, describe what you want in one line, and Pulse routes
          you to the appchain whose on-chain profile actually supports it —
          scored, explained, and gated on live risk.
        </p>

        {/* Free-text intent — optional, but this is where the routing
            becomes non-trivial. Parsed into verbs/assets/modifiers and
            matched against the initia-registry profile of each candidate. */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "11px 14px",
          borderRadius: 8,
          border: `1px solid ${parsedIntent ? "rgba(0,255,136,0.35)" : "rgba(0,212,255,0.18)"}`,
          background: parsedIntent ? "rgba(0,255,136,0.04)" : "rgba(0,212,255,0.03)",
          transition: "all 0.2s",
        }}>
          <Sparkles style={{
            width: 14, height: 14,
            color: parsedIntent ? "#00FF88" : "#00D4FF",
            flexShrink: 0,
          }} />
          <input
            type="text"
            value={intentText}
            onChange={e => setIntentText(e.target.value)}
            placeholder={
              action === "trade" ? "e.g. borrow USDC · trade ETH perps with leverage · liquid stake INIT" :
              action === "play"  ? "e.g. mint cities · virtual world game · onchain Kamigotchi" :
              action === "mint"  ? "e.g. mint NFT on Intergaze launchpad" :
              action === "stake" ? "e.g. stake 10 INIT with the most reliable validator" :
              "describe what you want to do on Initia"
            }
            style={{
              flex: 1, minWidth: 0,
              background: "transparent",
              border: "none", outline: "none",
              fontFamily: MONO, fontSize: 12,
              color: "#E0F0FF",
              letterSpacing: "0.01em",
            }}
          />
          {intentText && (
            <button
              onClick={() => setIntentText("")}
              style={{
                fontFamily: MONO, fontSize: 10, color: "#5A7A8A",
                background: "transparent", border: "none", cursor: "pointer",
                padding: "2px 6px",
              }}
            >
              clear
            </button>
          )}
        </div>

        {/* Parsed intent chip row — shows the user exactly what Pulse is
            matching against. Transparent about the scorer's inputs. */}
        {parsedIntent && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6,
            marginTop: 8, marginLeft: 2,
            fontFamily: MONO, fontSize: 10,
          }}>
            <span style={{ color: "#5A7A8A", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              parsed:
            </span>
            {parsedIntent.verbs.map(v => (
              <span key={`v-${v}`} style={{
                color: "#00FF88",
                padding: "2px 6px",
                background: "rgba(0,255,136,0.06)",
                border: "1px solid rgba(0,255,136,0.18)",
                borderRadius: 3,
              }}>{v}</span>
            ))}
            {parsedIntent.assets.map(a => (
              <span key={`a-${a}`} style={{
                color: "#00D4FF",
                padding: "2px 6px",
                background: "rgba(0,212,255,0.06)",
                border: "1px solid rgba(0,212,255,0.18)",
                borderRadius: 3,
              }}>{a.toUpperCase()}</span>
            ))}
            {parsedIntent.modifiers.map(m => (
              <span key={`m-${m}`} style={{
                color: "#A78BFA",
                padding: "2px 6px",
                background: "rgba(167,139,250,0.06)",
                border: "1px solid rgba(167,139,250,0.18)",
                borderRadius: 3,
              }}>{m}</span>
            ))}
          </div>
        )}
      </section>

      <section style={{
        display: "grid",
        gridTemplateColumns: isNarrow ? "1fr" : "260px 1fr",
        gap: 16,
        marginBottom: 24,
      }}>
        {/* Action column */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <StepDot n={1} active />
            <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: "#E0F0FF" }}>Action</span>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: isNarrow ? "repeat(4, 1fr)" : "1fr",
            gap: 6,
          }}>
            {ACTIONS.map(a => {
              const isActive = action === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setAction(a.id)}
                  style={{
                    padding: isNarrow ? "10px 6px" : "11px 13px",
                    borderRadius: 7,
                    border: isActive ? "1px solid rgba(0,255,136,0.4)" : "1px solid rgba(255,255,255,0.05)",
                    background: isActive ? "rgba(0,255,136,0.06)" : "rgba(10,18,24,0.5)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: isNarrow ? "column" : "row",
                    alignItems: "center",
                    gap: isNarrow ? 4 : 10,
                    textAlign: isNarrow ? "center" : "left",
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
                    {!isNarrow && (
                      <div style={{ fontFamily: MONO, fontSize: 9, color: "#5A7A8A", lineHeight: 1.4 }}>
                        {a.desc}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target column */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <StepDot n={2} active={!!action} />
            <span style={{
              fontFamily: SANS, fontSize: 13, fontWeight: 700,
              color: action ? "#E0F0FF" : "#5A7A8A",
            }}>
              Target
            </span>
            {!action && (
              <span style={{ fontFamily: MONO, fontSize: 10, color: "#5A7A8A", marginLeft: "auto" }}>
                pick an action first
              </span>
            )}
            {action && !l1OnlyAction && (
              <span style={{ fontFamily: MONO, fontSize: 10, color: "#5A7A8A", marginLeft: "auto" }}>
                sorted by pulse score
              </span>
            )}
          </div>

          {l1OnlyAction && (
            <InfoBanner color="#00D4FF">
              <strong style={{ color: "#E0F0FF" }}>
                {action === "stake" ? "Staking" : "Governance"} happens on Initia L1.
              </strong>{" "}
              Minitias are OPinit rollups run by a single operator — they don&apos;t have
              bonded validators or a gov module, so {action === "stake" ? "delegation" : "voting"} is only
              meaningful on L1.
            </InfoBanner>
          )}

          {noRollupsForAction && (
            <InfoBanner color="#FFB800">
              <strong style={{ color: "#E0F0FF" }}>No rollups in the current snapshot match this action.</strong>{" "}
              This usually means you&apos;re on testnet (VM sandboxes only). Switch to mainnet
              to see the real app-chains — Blackwing, Echelon, Rave for Trade; Civitia, Yominet for Play; Intergaze for Mint.
            </InfoBanner>
          )}

          <div style={{
            display: "flex", flexDirection: "column", gap: 5,
            opacity: action ? 1 : 0.4,
            pointerEvents: action ? "auto" : "none",
            transition: "opacity 0.2s",
          }}>
            {targets.map(t => {
              const isActive = target === t.chainId;
              return (
                <button
                  key={t.chainId}
                  onClick={() => setTarget(t.chainId)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 6,
                    border: isActive ? `1px solid ${t.color}55` : "1px solid rgba(255,255,255,0.04)",
                    background: isActive ? `${t.color}10` : "rgba(10,18,24,0.5)",
                    cursor: "pointer",
                    display: "flex", alignItems: "flex-start", gap: 11,
                    textAlign: "left",
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", background: t.color,
                    boxShadow: `0 0 8px ${t.color}`, flexShrink: 0, marginTop: 6,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: "#E0F0FF" }}>
                        {t.name}
                      </span>
                      {t.category && (
                        <CategoryBadge category={t.category} />
                      )}
                      <span style={{ fontFamily: MONO, fontSize: 9, color: "#5A7A8A" }}>
                        {t.chainId}
                      </span>
                      <span style={{
                        marginLeft: "auto",
                        fontFamily: MONO, fontSize: 10, fontWeight: 700, color: t.color,
                        padding: "3px 8px", borderRadius: 3,
                        background: `${t.color}12`, border: `1px solid ${t.color}25`,
                        letterSpacing: "0.05em",
                      }}>
                        {t.label} · {t.score}
                      </span>
                    </div>
                    {t.description && (
                      <div style={{
                        fontFamily: MONO, fontSize: 10, color: "#8AB4C8",
                        marginTop: 4, lineHeight: 1.5,
                      }}>
                        {t.description}
                      </div>
                    )}
                    {t.reasoning && t.reasoning.facts.length > 0 && (
                      <div style={{
                        display: "flex", flexWrap: "wrap", gap: 5,
                        marginTop: 6,
                      }}>
                        {t.reasoning.facts
                          .filter(f => f.kind !== "info")
                          .slice(0, 5)
                          .map((f, i) => (
                          <span key={i} style={{
                            fontFamily: MONO, fontSize: 9,
                            color: f.kind === "pass" ? "#00FF88" : "#FF3366",
                            padding: "1px 5px",
                            borderRadius: 2,
                            background: f.kind === "pass" ? "rgba(0,255,136,0.06)" : "rgba(255,51,102,0.06)",
                            border: `1px solid ${f.kind === "pass" ? "rgba(0,255,136,0.18)" : "rgba(255,51,102,0.18)"}`,
                          }}>
                            {f.kind === "pass" ? "✓" : "✗"} {f.label}
                          </span>
                        ))}
                        {t.reasoning.intentMatch > 0 && (
                          <span style={{
                            fontFamily: MONO, fontSize: 9, fontWeight: 700,
                            color: "#A78BFA",
                            marginLeft: "auto",
                            padding: "1px 5px",
                            borderRadius: 2,
                            background: "rgba(167,139,250,0.06)",
                            border: "1px solid rgba(167,139,250,0.18)",
                          }}>
                            intent {t.reasoning.intentMatch}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {action && target && !selectedTarget && (
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
              Target <code style={{ color: "#FFB800" }}>{target}</code> is not valid for this action
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: "#8AB4C8", lineHeight: 1.6 }}>
              Either the chain isn&apos;t in the registry, or the action isn&apos;t available on it. Pick a target from the list above.
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

      {action && selectedTarget && (
        selectedTarget.kind === "rollup" ? (
          <RollupVerdict
            action={action}
            minitia={selectedTarget.minitia}
            score={selectedTarget.score}
            risks={risksForAction(allRisks, risksActionKey(action), selectedTarget.chainId)}
            onReset={() => { setAction(null); setTarget(null); }}
          />
        ) : (
          <L1Verdict
            action={action}
            health={selectedTarget.health}
            chainId={selectedTarget.chainId}
            onReset={() => { setAction(null); setTarget(null); }}
          />
        )
      )}
    </div>
  );
}

function StepDot({ n, active }: { n: number; active: boolean }) {
  return (
    <span style={{
      width: 20, height: 20, borderRadius: "50%",
      border: active ? "1px solid rgba(0,255,136,0.4)" : "1px solid rgba(90,122,138,0.3)",
      background: active ? "rgba(0,255,136,0.08)" : "transparent",
      color: active ? "#00FF88" : "#5A7A8A",
      fontFamily: MONO, fontSize: 10, fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {n}
    </span>
  );
}

function InfoBanner({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: "11px 14px", marginBottom: 8,
      borderRadius: 6,
      border: `1px solid ${color}38`,
      background: `${color}0D`,
      display: "flex", alignItems: "flex-start", gap: 10,
    }}>
      <Info style={{ width: 14, height: 14, color, flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontFamily: MONO, fontSize: 11, color: "#8AB4C8", lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  );
}

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

// ─── Rollup verdict ───────────────────────────────────────────────────────
function RollupVerdict({ action, minitia, score, risks, onReset }: {
  action: Action; minitia: MinitiaWithMetrics; score: number; risks: Risk[]; onReset: () => void;
}) {
  const critical = risks.filter(r => r.severity === "critical");
  const elevated = risks.filter(r => r.severity === "elevated");

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

  const askPrompt = buildAskPromptRollup(action, minitia, verdict);
  const askHref = `/ask?prompt=${encodeURIComponent(askPrompt)}`;
  const category = minitia.profile?.category;

  return (
    <VerdictShell
      color={meta.color}
      Icon={Icon}
      label={meta.label}
      headline={meta.headline}
      subline={`${action.toUpperCase()} · ${minitia.prettyName ?? minitia.name}${category ? ` · ${category}` : ""} · pulse score ${score}/100`}
      onReset={onReset}
      askHref={askHref}
      blocked={verdict === "block"}
      askHeadline={verdict === "block" ? "Execution blocked" : "Execute via Ask Pulse"}
      askSub={verdict === "block"
        ? "Pulse will not pre-fill this action while the route is degraded."
        : "Opens the chat with a pre-filled prompt, guarded by this verdict."}
    >
      {minitia.profile?.description && (
        <div style={{
          fontFamily: MONO, fontSize: 11, color: "#8AB4C8",
          lineHeight: 1.55, marginBottom: 14,
          paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          {minitia.profile.description}
        </div>
      )}
      {risks.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {risks.map(r => <RiskRow key={r.id} risk={r} />)}
        </div>
      ) : (
        <div style={{ fontFamily: MONO, fontSize: 12, color: "#8AB4C8", lineHeight: 1.6 }}>
          No risks affecting <strong style={{ color: "#E0F0FF" }}>{action}</strong> currently apply to this rollup. The specific route is safe.
        </div>
      )}
    </VerdictShell>
  );
}

// ─── L1 verdict ────────────────────────────────────────────────────────────
function L1Verdict({ action, health, chainId, onReset }: {
  action: Action; health: L1Health; chainId: string; onReset: () => void;
}) {
  const baseVerdict: "allow" | "warn" | "block" =
    health.score < 25 ? "block" :
    health.score < 50 ? "warn" :
    "allow";

  const voteNoProposals = action === "vote" && health.activeProposals === 0;

  const META = {
    allow: { color: "#00FF88", Icon: CheckCircle2, label: "ALLOW", headline: "L1 is healthy" },
    warn:  { color: "#FFB800", Icon: ShieldAlert, label: "WARN",  headline: "L1 is degraded" },
    block: { color: "#FF3366", Icon: AlertTriangle, label: "BLOCK", headline: "L1 is unhealthy — action blocked" },
  } as const;
  const meta = META[baseVerdict];
  const { Icon } = meta;

  const askPrompt = buildAskPromptL1(action, chainId, baseVerdict);
  const askHref = `/ask?prompt=${encodeURIComponent(askPrompt)}`;

  return (
    <VerdictShell
      color={meta.color}
      Icon={Icon}
      label={meta.label}
      headline={meta.headline}
      subline={`${action.toUpperCase()} · Initia L1 (${chainId}) · health ${health.score}/100`}
      onReset={onReset}
      askHref={askHref}
      blocked={baseVerdict === "block"}
      askHeadline={baseVerdict === "block" ? "Execution blocked" : "Execute via Ask Pulse"}
      askSub={baseVerdict === "block"
        ? "Pulse will not pre-fill this action while L1 is unhealthy."
        : "Opens the chat with a pre-filled prompt, guarded by this verdict."}
    >
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12,
      }}>
        <L1Metric label="Validators" value={String(health.validators)} color="#00D4FF" />
        <L1Metric
          label="Last block"
          value={health.blockAgeSec >= 0 ? `${Math.round(health.blockAgeSec)}s ago` : "—"}
          color={health.blockAgeSec < 60 ? "#00FF88" : health.blockAgeSec < 300 ? "#FFB800" : "#FF3366"}
        />
        <L1Metric
          label="Active proposals"
          value={String(health.activeProposals)}
          color={health.activeProposals > 0 ? "#A78BFA" : "#5A7A8A"}
        />
      </div>

      {health.issues.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {health.issues.map((issue, i) => (
            <div key={i} style={{
              padding: "9px 12px", borderRadius: 6,
              border: `1px solid ${meta.color}20`,
              background: `${meta.color}06`,
              fontFamily: MONO, fontSize: 11, color: "#8AB4C8",
            }}>
              <AlertCircle style={{ width: 12, height: 12, color: meta.color, marginRight: 6, verticalAlign: -1 }} />
              {issue}
            </div>
          ))}
        </div>
      ) : voteNoProposals ? (
        <div style={{ fontFamily: MONO, fontSize: 12, color: "#8AB4C8", lineHeight: 1.6 }}>
          L1 is healthy, but there are <strong style={{ color: "#E0F0FF" }}>no active governance proposals</strong> to vote on right now. Check back when a proposal enters voting period.
        </div>
      ) : (
        <div style={{ fontFamily: MONO, fontSize: 12, color: "#8AB4C8", lineHeight: 1.6 }}>
          Initia L1 is producing blocks, the validator set is healthy, and no risks apply to <strong style={{ color: "#E0F0FF" }}>{action}</strong> right now.
        </div>
      )}
    </VerdictShell>
  );
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

function VerdictShell({
  color, Icon, label, headline, subline, onReset, askHref, blocked, askHeadline, askSub, children,
}: {
  color: string;
  Icon: typeof CheckCircle2;
  label: string;
  headline: string;
  subline: string;
  onReset: () => void;
  askHref: string;
  blocked: boolean;
  askHeadline: string;
  askSub: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <StepDot n={3} active />
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

      <div style={{
        padding: 24, borderRadius: 10,
        border: `1px solid ${color}40`,
        background: `linear-gradient(135deg, ${color}10, rgba(4,10,15,0.6))`,
        marginBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <Icon style={{ width: 40, height: 40, color }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SANS, fontSize: 26, fontWeight: 800, color, lineHeight: 1.1 }}>
              {headline}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: "#8AB4C8", marginTop: 5 }}>
              {subline}
            </div>
          </div>
          <span style={{
            fontFamily: MONO, fontSize: 11, fontWeight: 700, color,
            padding: "5px 12px", borderRadius: 4,
            background: `${color}15`, border: `1px solid ${color}30`,
            letterSpacing: "0.1em",
          }}>
            {label}
          </span>
        </div>
        {children}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Link href={askHref} style={{ flex: 1, textDecoration: "none" }}>
          <div style={{
            padding: "14px 18px", borderRadius: 8,
            border: blocked ? "1px solid rgba(255,51,102,0.25)" : "1px solid rgba(0,255,136,0.25)",
            background: blocked ? "rgba(255,51,102,0.05)" : "rgba(0,255,136,0.05)",
            display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
            opacity: blocked ? 0.5 : 1,
          }}>
            <Sparkles style={{ width: 16, height: 16, color: blocked ? "#FF3366" : "#00FF88" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: "#E0F0FF" }}>
                {askHeadline}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: "#8AB4C8", marginTop: 2 }}>
                {askSub}
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
