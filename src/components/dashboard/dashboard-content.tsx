"use client";

import { useState } from "react";
import Link from "next/link";
import { useEcosystem } from "@/hooks/use-ecosystem";
import { useInsights } from "@/hooks/use-insights";
import { useOracle } from "@/hooks/use-oracle";
import { SnapshotCountdown } from "@/components/snapshot-countdown";
import { IbcFlowMap } from "./ibc-flow-map";
import { ChainPanel } from "./chain-panel";
import { EcgHeartbeat } from "./ecg-heartbeat";
import {
  Loader2, AlertTriangle, Sparkles,
  Eye, ShieldCheck, Zap, ArrowRight, Globe,
  Activity, Database,
} from "lucide-react";
import { formatNumber } from "@/lib/format";

const MONO = "var(--font-jetbrains), monospace";
const SANS = "var(--font-chakra), sans-serif";

export function DashboardContent() {
  const { data, isLoading, error } = useEcosystem();
  const { data: insights } = useInsights();
  const { data: oracle } = useOracle();
  const [selectedChain, setSelectedChain] = useState<string | null>(null);

  const selectedMinitia = selectedChain
    ? (data?.minitias.find(m => m.chainId === selectedChain) ?? null)
    : null;

  if (isLoading) {
    return (
      <div style={{ display: "flex", minHeight: "80vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Loader2 style={{ width: 20, height: 20, color: "#00FF88" }} className="animate-spin" />
        <p style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "#5A7A8A" }}>
          Connecting to Initia…
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: "flex", minHeight: "80vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <AlertTriangle style={{ width: 20, height: 20, color: "#FF3366" }} />
        <p style={{ fontFamily: MONO, fontSize: 13, color: "#FF3366" }}>Connection failed. Retrying…</p>
      </div>
    );
  }

  const testnetMinitias = data.minitias.filter(m => !m.isMainnetRef);
  const mainnetCount = data.minitias.filter(m => m.isMainnetRef).length;
  const liveMinitias = testnetMinitias.filter(m => (m.metrics?.blockHeight ?? 0) > 0 || m.isOurs);
  const transferChannels = data.ibcChannels.filter(c => c.portId === "transfer");

  const healthLabel = insights?.ecosystem_health ?? "monitoring";
  const healthColor = healthLabel === "thriving" ? "#00FF88"
    : healthLabel === "growing" ? "#00D4FF" : "#5A7A8A";

  // AI nuggets — max 3
  const nuggets: { text: string; color: string }[] = [];
  if (insights) {
    if (insights.top_chain?.name && insights.top_chain.name !== "—") {
      nuggets.push({ text: `${insights.top_chain.name} — ${(insights.top_chain.reason ?? "").slice(0, 120)}`, color: "#00FF88" });
    }
    if (insights.key_insights?.length) {
      insights.key_insights.slice(0, 2).forEach((ki: { title: string; body: string }) => {
        nuggets.push({ text: `${ki.title ?? "Insight"} — ${(ki.body ?? "").slice(0, 120)}`, color: "#00D4FF" });
      });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — HERO: Clear value prop + vital signs
          ══════════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in" style={{ marginBottom: 24 }}>
        {/* Title + tagline */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <h1 style={{
              fontFamily: SANS, fontSize: 36, fontWeight: 800,
              color: "#E0F0FF", margin: 0, letterSpacing: "-0.03em", lineHeight: 1.1,
            }}>
              Ecosystem{" "}
              <span style={{
                background: "linear-gradient(135deg, #00FF88, #00D4FF)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>Pulse</span>
            </h1>
            {insights && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontFamily: MONO, fontSize: 11, color: healthColor,
                letterSpacing: "0.08em", textTransform: "uppercase",
                padding: "5px 12px", borderRadius: 4,
                background: `${healthColor}12`, border: `1px solid ${healthColor}25`,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", background: healthColor,
                  boxShadow: `0 0 8px ${healthColor}`,
                  animation: "pulse-glow-green 2s infinite",
                }} />
                {healthLabel}
              </span>
            )}
          </div>
          <p style={{
            fontFamily: MONO, fontSize: 14, color: "#8AB4C8",
            margin: 0, lineHeight: 1.6, maxWidth: 640,
          }}>
            The first AI that reads the Initia ecosystem, analyzes it, and writes its conclusions on-chain
            — an open intelligence layer for the Interwoven Economy.
          </p>
        </div>

        {/* Vital Signs — big readable metrics */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
        }}>
          {[
            { label: "Live Rollups", value: String(liveMinitias.length), color: "#00FF88", icon: <Activity style={{ width: 14, height: 14 }} /> },
            { label: "IBC Channels", value: String(transferChannels.length), color: "#00D4FF", icon: <Globe style={{ width: 14, height: 14 }} /> },
            { label: "L1 Block Height", value: data.l1.blockHeight > 0 ? formatNumber(data.l1.blockHeight) : "—", color: "#5A7A8A", icon: <Database style={{ width: 14, height: 14 }} /> },
            { label: "Oracle Writes", value: "5min", color: "#A78BFA", icon: <ShieldCheck style={{ width: 14, height: 14 }} /> },
          ].map(m => (
            <div key={m.label} style={{
              padding: "16px 18px",
              border: "1px solid rgba(0,255,136,0.06)",
              borderRadius: 8,
              background: "rgba(10,18,24,0.6)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ color: m.color, opacity: 0.6 }}>{m.icon}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5A7A8A" }}>
                  {m.label}
                </span>
              </div>
              <span style={{ fontFamily: SANS, fontSize: 28, fontWeight: 700, color: m.color, lineHeight: 1 }}>
                {m.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — IBC MAP: Clean, no overlays
          ══════════════════════════════════════════════════════════════ */}
      <section className="animate-slide-up" style={{
        position: "relative",
        marginBottom: 20,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(0,255,136,0.06)",
      }}>
        <IbcFlowMap
          ibcChannels={data.ibcChannels}
          minitias={data.minitias}
          onSelect={(chainId) => setSelectedChain(prev => prev === chainId ? null : chainId)}
          selectedChain={selectedChain}
          height={460}
        />

        {selectedMinitia && (
          <ChainPanel
            minitia={selectedMinitia}
            ibcChannels={data.ibcChannels}
            onClose={() => setSelectedChain(null)}
          />
        )}

        {/* Mainnet indicator — bottom-left, subtle */}
        {mainnetCount > 0 && (
          <div style={{
            position: "absolute", bottom: 14, left: 14,
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px",
            background: "rgba(4,10,15,0.8)",
            borderRadius: 4, border: "1px solid rgba(255,255,255,0.04)",
          }}>
            <Globe style={{ width: 12, height: 12, color: "#5A7A8A" }} />
            <span style={{ fontFamily: MONO, fontSize: 11, color: "#5A7A8A" }}>
              +{mainnetCount} mainnet chains (read-only)
            </span>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 — AI INSIGHTS: Separate, readable section
          ══════════════════════════════════════════════════════════════ */}
      {nuggets.length > 0 && (
        <section className="animate-slide-up delay-100" style={{
          marginBottom: 20, padding: "20px 24px",
          border: "1px solid rgba(0,255,136,0.08)",
          borderRadius: 8,
          background: "linear-gradient(135deg, rgba(0,255,136,0.02), rgba(0,212,255,0.01))",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Sparkles style={{ width: 14, height: 14, color: "#00FF88" }} />
            <span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: "#E0F0FF" }}>
              AI Analysis
            </span>
            <div style={{ flex: 1, height: 1, background: "rgba(0,255,136,0.06)" }} />
            <SnapshotCountdown latestTimestamp={oracle?.latest ? Number(oracle.latest.timestamp) : null} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {nuggets.map((nugget, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Zap style={{ width: 12, height: 12, color: nugget.color, flexShrink: 0, marginTop: 3 }} />
                <span style={{ fontFamily: MONO, fontSize: 13, color: "#8AB4C8", lineHeight: 1.6 }}>
                  {nugget.text}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION 4 — ECG HEARTBEAT (brand signature)
          ══════════════════════════════════════════════════════════════ */}
      <section className="animate-slide-up delay-200" style={{ marginBottom: 20 }}>
        <EcgHeartbeat recentBlocks={data.l1.recentBlocks} height={110} />
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 5 — ASK PULSE CTA (prominent)
          ══════════════════════════════════════════════════════════════ */}
      <Link href="/ask" style={{ textDecoration: "none" }}>
        <section className="animate-slide-up delay-300" style={{
          position: "relative",
          padding: "22px 28px",
          marginBottom: 20,
          borderRadius: 8,
          border: "1px solid rgba(0,255,136,0.15)",
          background: "linear-gradient(135deg, rgba(0,255,136,0.04), rgba(0,212,255,0.02))",
          display: "flex", alignItems: "center", gap: 18,
          cursor: "pointer",
          transition: "all 0.2s",
          overflow: "hidden",
        }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = "rgba(0,255,136,0.35)";
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,255,136,0.08)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = "rgba(0,255,136,0.15)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "rgba(0,255,136,0.08)",
            border: "1px solid rgba(0,255,136,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Sparkles style={{ width: 20, height: 20, color: "#00FF88" }} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: SANS, fontSize: 17, fontWeight: 700, color: "#E0F0FF", display: "block" }}>
              Ask Pulse
            </span>
            <span style={{ fontFamily: MONO, fontSize: 13, color: "#8AB4C8", display: "block", marginTop: 3 }}>
              Ask anything about the ecosystem — deploy advice, staking, bridge routes, all grounded in live on-chain data.
            </span>
          </div>
          <ArrowRight style={{ width: 18, height: 18, color: "#00FF88", opacity: 0.6, flexShrink: 0 }} />
        </section>
      </Link>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 6 — WORKFLOW: Monitor → Verify → Act
          ══════════════════════════════════════════════════════════════ */}
      <section className="animate-slide-up delay-400" style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12,
        marginBottom: 20,
      }}>
        {[
          {
            href: "/",
            step: "01",
            icon: <Eye style={{ width: 16, height: 16 }} />,
            label: "Monitor",
            desc: "Live topology map, health scores, and AI anomaly detection across all rollups.",
            accent: "#00FF88",
            active: true,
          },
          {
            href: "/oracle",
            step: "02",
            icon: <ShieldCheck style={{ width: 16, height: 16 }} />,
            label: "Verify",
            desc: "AI intelligence written on-chain every 5 min — trustless, immutable, composable by any contract.",
            accent: "#00D4FF",
            active: false,
          },
          {
            href: "/advisor",
            step: "03",
            icon: <Zap style={{ width: 16, height: 16 }} />,
            label: "Act",
            desc: "Deploy, stake, or bridge with AI recommendations grounded in on-chain oracle data.",
            accent: "#A78BFA",
            active: false,
          },
        ].map((card) => (
          <Link key={card.href} href={card.href} style={{ textDecoration: "none" }}>
            <div style={{
              padding: "20px",
              border: `1px solid ${card.active ? card.accent + "25" : card.accent + "10"}`,
              borderRadius: 8,
              background: card.active ? `${card.accent}06` : "transparent",
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex", flexDirection: "column", gap: 10,
              minHeight: 140,
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = `${card.accent}40`;
                e.currentTarget.style.background = `${card.accent}0A`;
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = card.active ? `${card.accent}25` : `${card.accent}10`;
                e.currentTarget.style.background = card.active ? `${card.accent}06` : "transparent";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: card.accent, opacity: 0.5 }}>
                  {card.step}
                </span>
                <span style={{ color: card.accent, opacity: 0.7 }}>{card.icon}</span>
                {card.active && (
                  <span style={{
                    fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: card.accent, padding: "3px 8px", borderRadius: 3,
                    background: `${card.accent}12`, marginLeft: "auto",
                  }}>
                    Active
                  </span>
                )}
              </div>
              <span style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, color: "#E0F0FF" }}>
                {card.label}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: "#8AB4C8", lineHeight: 1.6, flex: 1 }}>
                {card.desc}
              </span>
              {!card.active && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: card.accent, opacity: 0.5 }}>
                    Explore
                  </span>
                  <ArrowRight style={{ width: 11, height: 11, color: card.accent, opacity: 0.4 }} />
                </div>
              )}
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
