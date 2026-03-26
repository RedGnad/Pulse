"use client";

import Link from "next/link";
import { MinitiaWithMetrics } from "@/lib/types";
import { formatNumber } from "@/lib/format";

interface MinitiaGridProps {
  minitias: MinitiaWithMetrics[];
}

function chainColor(name: string): string {
  const colors = ["#00D4FF","#F0A000","#00B86B","#8B5CF6","#EC4899","#F97316","#06B6D4","#84CC16","#EF4444","#A78BFA","#14B8A6","#F59E0B","#6366F1"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

export function MinitiaGrid({ minitias }: MinitiaGridProps) {
  const sorted = [...minitias].sort((a, b) => (b.metrics?.totalTxCount ?? 0) - (a.metrics?.totalTxCount ?? 0));
  const maxTx = Math.max(...minitias.map(m => m.metrics?.totalTxCount ?? 0), 1);

  return (
    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
      {sorted.map((m, rank) => {
        const isLive = (m.metrics?.blockHeight ?? 0) > 0 || m.isOurs;
        const isOurs = m.isOurs;
        const color = isOurs ? "#00D4FF" : chainColor(m.prettyName);
        const txPct = ((m.metrics?.totalTxCount ?? 0) / maxTx) * 100;
        const hasTxs = (m.metrics?.totalTxCount ?? 0) > 0;
        const isFast = (m.metrics?.avgBlockTime ?? 99) < 2;

        return (
          <Link
            key={m.chainId}
            href={isOurs ? "/oracle" : `/minitia/${encodeURIComponent(m.chainId)}`}
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                padding: "14px 14px 12px",
                border: isOurs ? "1px solid rgba(0,212,255,0.18)" : "1px solid rgba(255,255,255,0.04)",
                borderTop: isOurs ? "2px solid rgba(0,212,255,0.7)" : `2px solid ${color}${isLive ? "55" : "1A"}`,
                borderRadius: 3,
                background: isOurs ? "rgba(0,212,255,0.04)" : "rgba(8,12,18,0.6)",
                boxShadow: isOurs ? "0 0 20px rgba(0,212,255,0.08), inset 0 0 20px rgba(0,212,255,0.03)" : "none",
                cursor: "pointer",
                transition: "all 0.12s ease",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = `${color}07`;
                el.style.borderTopColor = `${color}99`;
                el.style.borderColor = `${color}18`;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = isOurs ? "rgba(0,212,255,0.04)" : "rgba(8,12,18,0.6)";
                el.style.borderTopColor = `${color}${isLive ? "55" : "1A"}`;
                el.style.borderColor = isOurs ? "rgba(0,212,255,0.18)" : "rgba(255,255,255,0.04)";
              }}
            >
              {/* Ambient top glow */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 36,
                background: `linear-gradient(180deg, ${color}08 0%, transparent 100%)`,
                pointerEvents: "none",
              }} />

              {/* Top-left corner bracket */}
              <div style={{
                position: "absolute", top: -1, left: -1,
                width: 8, height: 8,
                borderTop: `1px solid ${color}55`,
                borderLeft: `1px solid ${color}55`,
                pointerEvents: "none",
              }} />

              {/* Rank / "OURS" badge */}
              <div style={{
                position: "absolute", top: 10, right: 10,
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: isOurs ? 7 : 8,
                color: isOurs ? "rgba(0,212,255,0.6)" : `${color}30`,
                letterSpacing: "0.1em",
                background: isOurs ? "rgba(0,212,255,0.08)" : "transparent",
                border: isOurs ? "1px solid rgba(0,212,255,0.25)" : "none",
                padding: isOurs ? "1px 5px" : "0",
                borderRadius: 2,
              }}>
                {isOurs ? "OUR ROLLUP" : `#${String(rank + 1).padStart(2, "0")}`}
              </div>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, position: "relative" }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${color}12`, border: `1px solid ${color}${isOurs ? "55" : "30"}`,
                  fontFamily: "var(--font-chakra), sans-serif",
                  fontSize: 8.5, fontWeight: 700, color,
                  flexShrink: 0,
                  boxShadow: isOurs ? `0 0 8px ${color}30` : "none",
                }}>
                  {isOurs ? "IP" : m.prettyName.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{
                    fontFamily: "var(--font-chakra), sans-serif",
                    fontSize: 13, fontWeight: 600, color: "#C0D0D8",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {m.prettyName}
                  </div>
                </div>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: isLive ? "#00B86B" : "#1E2E38",
                  boxShadow: isLive ? "0 0 6px #00B86B" : "none",
                  flexShrink: 0,
                }} />
              </div>

              {/* Metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 7.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "#1A2830", marginBottom: 2 }}>Blocks</div>
                  <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 13, fontWeight: 600, color: "#5A7A8A", fontVariantNumeric: "tabular-nums" }}>
                    {m.metrics?.blockHeight ? formatNumber(m.metrics.blockHeight) : "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 7.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "#1A2830", marginBottom: 2 }}>Txs</div>
                  <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 13, fontWeight: 600, color: hasTxs ? color : "#1A2830", fontVariantNumeric: "tabular-nums" }}>
                    {hasTxs ? formatNumber(m.metrics!.totalTxCount) : "—"}
                  </div>
                </div>
                {m.metrics?.avgBlockTime && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 7.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "#1A2830", marginBottom: 2 }}>Block time</div>
                    <div style={{
                      fontFamily: "var(--font-jetbrains), monospace",
                      fontSize: 11,
                      color: isFast ? "#00B86B" : "#5A7A8A",
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      {m.metrics.avgBlockTime < 2 ? m.metrics.avgBlockTime.toFixed(2) : m.metrics.avgBlockTime.toFixed(1)}s
                      {isFast && <span style={{ fontSize: 9, color: "#00B86B" }}>fast</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Activity bar */}
              <div style={{ height: 1.5, background: "rgba(255,255,255,0.04)", borderRadius: 1, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 1,
                  width: `${txPct}%`,
                  background: `linear-gradient(90deg, ${color}${isLive ? "BB" : "33"}, ${color}${isLive ? "44" : "11"})`,
                  transition: "width 0.8s ease",
                }} />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
