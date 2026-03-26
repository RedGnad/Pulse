"use client";

import Link from "next/link";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { MinitiaWithMetrics, IbcChannel } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { chainColor } from "./ibc-flow-map";
import { X, ExternalLink, ArrowRightLeft, Zap } from "lucide-react";

interface ChainPanelProps {
  minitia: MinitiaWithMetrics | null;
  ibcChannels: IbcChannel[];
  onClose: () => void;
}

export function ChainPanel({ minitia, ibcChannels, onClose }: ChainPanelProps) {
  const { address, openBridge, openConnect } = useInterwovenKit();
  const isConnected = !!address;

  if (!minitia) return null;

  const isOurs = minitia.isOurs;
  const color = isOurs ? "#00FF88" : chainColor(minitia.prettyName);
  const isLive = (minitia.metrics?.blockHeight ?? 0) > 0;
  const isFast = (minitia.metrics?.avgBlockTime ?? 99) < 2;
  const channelsForChain = ibcChannels.filter(
    ch => ch.portId === "transfer" && (ch.sourceChainId === minitia.chainId || ch.destChainId === minitia.chainId)
  );

  const handleBridge = () => {
    if (!isConnected) {
      openConnect();
      return;
    }
    openBridge({
      srcChainId: "initiation-2",
      dstChainId: minitia.chainId,
    });
  };

  return (
    <div style={{
      position: "absolute", top: 0, right: 0, bottom: 0,
      width: 300,
      background: "rgba(4,10,15,0.97)",
      borderLeft: `1px solid ${color}22`,
      borderTop: `2px solid ${color}66`,
      display: "flex", flexDirection: "column",
      zIndex: 20,
      animation: "slide-up 0.2s cubic-bezier(0.16,1,0.3,1) both",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid rgba(0,255,136,0.04)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 3,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `${color}14`, border: `1px solid ${color}33`,
            fontFamily: "var(--font-chakra), sans-serif",
            fontSize: 10, fontWeight: 700, color,
          }}>
            {minitia.prettyName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontFamily: "var(--font-chakra), sans-serif", fontSize: 14, fontWeight: 600, color: "#E0F0FF" }}>
                {minitia.prettyName}
              </div>
              {isOurs && (
                <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 6.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "#00FF88", background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.25)", padding: "1px 5px", borderRadius: 2 }}>
                  our rollup
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
              <span style={{
                display: "block", width: 5, height: 5, borderRadius: "50%",
                background: isLive ? "#00FF88" : "#0A1218",
                boxShadow: isLive ? "0 0 5px #00FF88" : "none",
              }} />
              <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 8, color: isLive ? "#00FF88" : "#0A1218", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                {isLive ? "Live" : "Offline"}
              </span>
              <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 8, color: "#1E3040", letterSpacing: "0.1em" }}>
                {minitia.networkType}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#1E3040", padding: 4 }}
          onMouseEnter={e => (e.currentTarget.style.color = "#E0F0FF")}
          onMouseLeave={e => (e.currentTarget.style.color = "#1E3040")}
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Metrics */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,255,136,0.04)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Stat label="Block Height" value={minitia.metrics?.blockHeight ? formatNumber(minitia.metrics.blockHeight) : "—"} color={color} />
          <Stat label="Total Txs" value={minitia.metrics?.totalTxCount ? formatNumber(minitia.metrics.totalTxCount) : "—"} color={color} />
          <Stat
            label="Block Time"
            value={minitia.metrics?.avgBlockTime ? `${minitia.metrics.avgBlockTime.toFixed(2)}s` : "—"}
            color={isFast ? "#00FF88" : color}
            highlight={isFast}
          />
          <Stat label="IBC Channels" value={channelsForChain.length.toString()} color={color} />
        </div>
      </div>

      {/* Chain ID */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(0,255,136,0.04)" }}>
        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 7.5, letterSpacing: "0.2em", color: "#1E3040", textTransform: "uppercase", marginBottom: 4 }}>Chain ID</div>
        <code style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9.5, color: "#00D4FF" }}>
          {minitia.chainId}
        </code>
      </div>

      {/* IBC connections */}
      {channelsForChain.length > 0 && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(0,255,136,0.04)", flex: 1, overflowY: "auto" }}>
          <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 7.5, letterSpacing: "0.2em", color: "#1E3040", textTransform: "uppercase", marginBottom: 8 }}>
            IBC Connections
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {channelsForChain.slice(0, 5).map(ch => (
              <div key={ch.channelId} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "5px 8px",
                background: "rgba(0,255,136,0.02)", border: "1px solid rgba(0,255,136,0.04)", borderRadius: 2,
              }}>
                <code style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, color: "#00FF88" }}>{ch.channelId}</code>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ArrowRightLeft style={{ width: 8, height: 8, color: "#1E3040" }} />
                  <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 8, color: "#00D4FF" }}>
                    {ch.sourceChainId === minitia.chainId ? ch.destChainId.split("-")[0] : ch.sourceChainId.split("-")[0]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
        <button
          onClick={handleBridge}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 16px",
            background: `linear-gradient(135deg, ${color}18, ${color}0A)`,
            border: `1px solid ${color}44`,
            borderRadius: 3, cursor: "pointer",
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 10, fontWeight: 600, letterSpacing: "0.15em",
            color, textTransform: "uppercase",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}88`;
            (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, ${color}28, ${color}14)`;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}44`;
            (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, ${color}18, ${color}0A)`;
          }}
        >
          <Zap style={{ width: 12, height: 12 }} />
          {isConnected ? "Bridge to this chain" : "Connect to Bridge"}
        </button>

        <div style={{ display: "flex", gap: 6 }}>
          <Link
            href={minitia.isOurs ? "/oracle" : `/minitia/${encodeURIComponent(minitia.chainId)}`}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              padding: "7px 10px",
              border: "1px solid rgba(0,255,136,0.08)", borderRadius: 2,
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 9, color: "#1E3040", textDecoration: "none",
              letterSpacing: "0.15em", textTransform: "uppercase",
              transition: "color 0.12s, border-color 0.12s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.color = "#00FF88";
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,255,136,0.25)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.color = "#1E3040";
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,255,136,0.08)";
            }}
          >
            {minitia.isOurs ? "PulseOracle →" : "Full Details"}
          </Link>
          {minitia.explorerUrl && (
            <a
              href={minitia.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "7px 10px",
                border: "1px solid rgba(0,255,136,0.08)", borderRadius: 2,
                color: "#1E3040", textDecoration: "none",
                transition: "color 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#00FF88")}
              onMouseLeave={e => (e.currentTarget.style.color = "#1E3040")}
            >
              <ExternalLink style={{ width: 12, height: 12 }} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: "8px 10px",
      background: "rgba(0,255,136,0.02)", border: "1px solid rgba(0,255,136,0.04)", borderRadius: 2,
    }}>
      <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 7.5, letterSpacing: "0.2em", textTransform: "uppercase", color: "#1E3040", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontFamily: "var(--font-jetbrains), monospace",
        fontSize: 14, fontWeight: 700,
        color: highlight ? color : "#5A7A8A",
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </div>
    </div>
  );
}
