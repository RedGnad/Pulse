"use client";

import { useState } from "react";
import Link from "next/link";
import { useEcosystem } from "@/hooks/use-ecosystem";
import { useOracle } from "@/hooks/use-oracle";
import { SnapshotCountdown } from "@/components/snapshot-countdown";
import { IbcFlowMap } from "./ibc-flow-map";
import { ChainPanel } from "./chain-panel";
import { CurrentRisks } from "./current-risks";
import {
  Loader2, AlertTriangle, Sparkles,
  ShieldCheck, Zap, ArrowRight, Globe,
  Activity, Database,
} from "lucide-react";
import { formatNumber } from "@/lib/format";
import { useNetwork } from "@/contexts/network-context";

const MONO = "var(--font-jetbrains), monospace";
const SANS = "var(--font-chakra), sans-serif";

export function DashboardContent() {
  const { data, isLoading, error } = useEcosystem();
  const { data: oracle } = useOracle();
  const { isMainnet } = useNetwork();
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — HERO: thesis + small metric strip
          ══════════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{
            fontFamily: SANS, fontSize: 36, fontWeight: 800,
            color: "#E0F0FF", margin: 0, letterSpacing: "-0.03em", lineHeight: 1.1,
          }}>
            Block unsafe actions before they hit{" "}
            <span
              className="pulse-gradient-text"
              style={{
                backgroundImage: isMainnet
                  ? "linear-gradient(90deg, #FFB800, #00D4FF, #FFB800, #00FF88, #FFB800)"
                  : "linear-gradient(90deg, #00FF88, #00D4FF, #A78BFA, #00FF88)",
              }}
            >Initia rollups.</span>
          </h1>
          <p style={{
            fontFamily: MONO, fontSize: 13, color: "#8AB4C8",
            margin: "10px 0 0", lineHeight: 1.6, maxWidth: 680,
          }}>
            Pulse scores every rollup, route, and IBC channel live and writes the
            signal on-chain. <span style={{ color: "#E0F0FF" }}>30 lines of Solidity</span> let any contract gate
            deposits, bridges, or votes when the target is degraded.
          </p>
        </div>

        {/* Compact metric strip — secondary, not the headline */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
        }}>
          {[
            { label: "Live rollups", value: String(liveMinitias.length), color: "#00FF88", icon: <Activity style={{ width: 12, height: 12 }} /> },
            { label: "Transfer channels", value: String(transferChannels.length), color: "#00D4FF", icon: <Globe style={{ width: 12, height: 12 }} /> },
            { label: "Oracle snapshots", value: oracle?.snapshotCount && Number(oracle.snapshotCount) > 0 ? formatNumber(Number(oracle.snapshotCount)) : "—", color: "#A78BFA", icon: <Database style={{ width: 12, height: 12 }} /> },
            { label: "Next write", value: null as React.ReactNode, color: "#FFB800", icon: <ShieldCheck style={{ width: 12, height: 12 }} />, isCountdown: true },
          ].map(m => (
            <div key={m.label} style={{
              padding: "10px 12px",
              border: "1px solid rgba(0,255,136,0.06)",
              borderRadius: 6,
              background: "rgba(10,18,24,0.6)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ color: m.color, opacity: 0.5 }}>{m.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5A7A8A" }}>
                  {m.label}
                </div>
                {"isCountdown" in m && m.isCountdown ? (
                  <SnapshotCountdown latestTimestamp={oracle?.latest ? Number(oracle.latest.timestamp) : null} fontSize={15} color={m.color} mono={false} />
                ) : (
                  <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 700, color: m.color, lineHeight: 1.1 }}>
                    {m.value}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — CURRENT RISKS (the actual product)
          ══════════════════════════════════════════════════════════════ */}
      <CurrentRisks eco={data} limit={4} />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 — PRIMARY CTAs: Gate + Act
          ══════════════════════════════════════════════════════════════ */}
      <section className="animate-slide-up" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20,
      }}>
        <CtaCard
          href="/act"
          accent="#00FF88"
          title="Act on the signal"
          desc="Pick an action, pick a target. Pulse scores the specific route and only lets you proceed if it's safe."
          icon={<Zap style={{ width: 18, height: 18 }} />}
        />
        <CtaCard
          href="/gate"
          accent="#00D4FF"
          title="Gate your contract"
          desc="Any on-chain contract can subscribe to the Pulse signal and block deposits, bridges, or votes during risk events."
          icon={<ShieldCheck style={{ width: 18, height: 18 }} />}
        />
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 4 — IBC MAP (topology context, secondary)
          ══════════════════════════════════════════════════════════════ */}
      <section className="animate-slide-up delay-100" style={{
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
          height={420}
        />

        {selectedMinitia && (
          <ChainPanel
            minitia={selectedMinitia}
            ibcChannels={data.ibcChannels}
            onClose={() => setSelectedChain(null)}
          />
        )}

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
          SECTION 5 — Ask Pulse (chat shortcut)
          ══════════════════════════════════════════════════════════════ */}
      <Link href="/ask" style={{ textDecoration: "none" }}>
        <section className="animate-slide-up delay-200" style={{
          padding: "16px 22px",
          marginBottom: 20,
          borderRadius: 8,
          border: "1px solid rgba(0,255,136,0.12)",
          background: "linear-gradient(135deg, rgba(0,255,136,0.03), rgba(0,212,255,0.015))",
          display: "flex", alignItems: "center", gap: 14,
          cursor: "pointer",
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: "rgba(0,255,136,0.08)",
            border: "1px solid rgba(0,255,136,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Sparkles style={{ width: 15, height: 15, color: "#00FF88" }} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: "#E0F0FF", display: "block" }}>
              Prefer to just ask?
            </span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: "#8AB4C8", display: "block", marginTop: 2 }}>
              Ask Pulse in natural language. Same signal, same gate, same execution.
            </span>
          </div>
          <ArrowRight style={{ width: 14, height: 14, color: "#00FF88", opacity: 0.5, flexShrink: 0 }} />
        </section>
      </Link>
    </div>
  );
}

function CtaCard({ href, accent, title, desc, icon }: {
  href: string; accent: string; title: string; desc: string; icon: React.ReactNode;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          padding: "18px 20px", minHeight: 120,
          borderRadius: 10,
          border: `1px solid ${accent}25`,
          background: `linear-gradient(135deg, ${accent}08, rgba(10,18,24,0.4))`,
          display: "flex", flexDirection: "column", gap: 8,
          cursor: "pointer",
          transition: "all 0.2s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = `${accent}55`;
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = `0 8px 32px ${accent}10`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = `${accent}25`;
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 7,
            background: `${accent}12`, border: `1px solid ${accent}25`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: accent, flexShrink: 0,
          }}>
            {icon}
          </div>
          <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, color: "#E0F0FF" }}>
            {title}
          </span>
          <ArrowRight style={{ marginLeft: "auto", width: 14, height: 14, color: accent, opacity: 0.6 }} />
        </div>
        <span style={{
          fontFamily: MONO, fontSize: 12, color: "#8AB4C8", lineHeight: 1.6,
        }}>
          {desc}
        </span>
      </div>
    </Link>
  );
}
