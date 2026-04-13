"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, AlertTriangle, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Risk, deriveRisks } from "@/lib/risks";
import { EcosystemOverview } from "@/lib/types";

function useLiveAge(timestamp: string | undefined): string {
  const [age, setAge] = useState<string>("—");
  useEffect(() => {
    if (!timestamp) return;
    const tick = () => {
      const ms = Date.now() - new Date(timestamp).getTime();
      if (!Number.isFinite(ms) || ms < 0) { setAge("just now"); return; }
      const s = Math.floor(ms / 1000);
      if (s < 60)   setAge(`${s}s ago`);
      else if (s < 3600) setAge(`${Math.floor(s / 60)}m ${s % 60}s ago`);
      else          setAge(`${Math.floor(s / 3600)}h ago`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timestamp]);
  return age;
}

function LiveBadge({ lastUpdated }: { lastUpdated: string | undefined }) {
  const age = useLiveAge(lastUpdated);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: "var(--font-jetbrains), monospace", fontSize: 10,
      padding: "3px 9px", borderRadius: 3,
      background: "rgba(0,255,136,0.05)",
      border: "1px solid rgba(0,255,136,0.15)",
      color: "#00FF88", letterSpacing: "0.08em",
    }}>
      <span style={{
        display: "block", width: 6, height: 6, borderRadius: "50%",
        background: "#00FF88", boxShadow: "0 0 6px #00FF88",
        animation: "pulse-glow-green 2s infinite",
      }} />
      LIVE · {age}
    </span>
  );
}

const MONO = "var(--font-jetbrains), monospace";
const SANS = "var(--font-chakra), sans-serif";

const SEVERITY_META: Record<Risk["severity"], { color: string; label: string; Icon: typeof AlertTriangle }> = {
  critical: { color: "#FF3366", label: "CRITICAL", Icon: AlertTriangle },
  elevated: { color: "#FFB800", label: "ELEVATED", Icon: ShieldAlert },
  watch:    { color: "#00D4FF", label: "WATCH",    Icon: AlertCircle },
};

export function CurrentRisks({ eco, limit = 4 }: { eco: EcosystemOverview; limit?: number }) {
  const all = deriveRisks(eco);
  const top = all.slice(0, limit);
  const totalCritical = all.filter(r => r.severity === "critical").length;
  const totalElevated = all.filter(r => r.severity === "elevated").length;

  if (top.length === 0) {
    return (
      <section style={{
        marginBottom: 20, padding: "20px 24px",
        border: "1px solid rgba(0,255,136,0.12)", borderRadius: 10,
        background: "linear-gradient(135deg, rgba(0,255,136,0.04), rgba(0,212,255,0.02))",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <CheckCircle2 style={{ width: 22, height: 22, color: "#00FF88" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: "#E0F0FF" }}>
            No active risks
          </div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: "#8AB4C8", marginTop: 3 }}>
            Every reachable rollup is producing blocks and scoring above the caution threshold. Safe to bridge, stake, and act.
          </div>
        </div>
        <LiveBadge lastUpdated={eco.lastUpdated} />
      </section>
    );
  }

  return (
    <section style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
      }}>
        <ShieldAlert style={{ width: 16, height: 16, color: "#FFB800" }} />
        <span style={{
          fontFamily: SANS, fontSize: 15, fontWeight: 700, color: "#E0F0FF",
        }}>
          Current risks
        </span>
        <span style={{
          fontFamily: MONO, fontSize: 11, color: "#5A7A8A",
          padding: "2px 8px", borderRadius: 3,
          background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.1)",
          letterSpacing: "0.05em",
        }}>
          {totalCritical} critical · {totalElevated} elevated · {all.length - totalCritical - totalElevated} watch
        </span>
        <LiveBadge lastUpdated={eco.lastUpdated} />
        <div style={{ flex: 1, height: 1, background: "rgba(255,184,0,0.06)" }} />
        <Link href="/act" style={{
          fontFamily: MONO, fontSize: 11, color: "#00FF88",
          textDecoration: "none", letterSpacing: "0.05em",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          Act on these <ArrowRight style={{ width: 11, height: 11 }} />
        </Link>
      </div>

      {/* Risk cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {top.map(risk => (
          <RiskCard key={risk.id} risk={risk} />
        ))}
      </div>
    </section>
  );
}

function RiskCard({ risk }: { risk: Risk }) {
  const meta = SEVERITY_META[risk.severity];
  const { Icon, color, label } = meta;
  const href = risk.targetChainId
    ? `/act?target=${encodeURIComponent(risk.targetChainId)}`
    : "/act";

  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 8,
          border: `1px solid ${color}25`,
          background: `linear-gradient(90deg, ${color}08, rgba(10,18,24,0.4))`,
          display: "flex", alignItems: "flex-start", gap: 14,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = `${color}55`;
          e.currentTarget.style.transform = "translateX(2px)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = `${color}25`;
          e.currentTarget.style.transform = "translateX(0)";
        }}
      >
        <Icon style={{ width: 16, height: 16, color, flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{
              fontFamily: MONO, fontSize: 9, fontWeight: 700,
              color, letterSpacing: "0.1em",
              padding: "2px 6px", borderRadius: 2,
              background: `${color}10`, border: `1px solid ${color}25`,
            }}>
              {label}
            </span>
            <span style={{
              fontFamily: SANS, fontSize: 14, fontWeight: 600, color: "#E0F0FF",
            }}>
              {risk.headline}
            </span>
            {typeof risk.score === "number" && (
              <span style={{
                marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "#5A7A8A",
              }}>
                pulse {risk.score}
              </span>
            )}
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 12, color: "#8AB4C8",
            lineHeight: 1.5, marginBottom: 6,
          }}>
            {risk.detail}
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 11, color,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ opacity: 0.6 }}>→</span>
            {risk.recommendation}
          </div>
        </div>
      </div>
    </Link>
  );
}
