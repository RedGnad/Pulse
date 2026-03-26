"use client";

import { useInterwovenKit, usePortfolio } from "@initia/interwovenkit-react";
import { ArrowRightLeft, Download, Upload, Loader2 } from "lucide-react";

const btn = {
  display: "flex" as const, alignItems: "center" as const, gap: 5,
  padding: "5px 12px",
  border: "1px solid rgba(232,163,58,0.2)", borderRadius: 3,
  background: "rgba(232,163,58,0.05)", cursor: "pointer" as const,
  fontFamily: "var(--font-jetbrains), monospace",
  fontSize: 9, letterSpacing: "0.15em", color: "#9A8A78",
  textTransform: "uppercase" as const,
  transition: "all 0.15s",
};

const bridgeBtn = {
  ...btn,
  borderColor: "rgba(52,211,153,0.25)",
  color: "#34D399",
  background: "rgba(52,211,153,0.05)",
};

export function WalletPortfolio() {
  const { isConnected, openBridge, openDeposit, openWithdraw } = useInterwovenKit();
  const { isLoading, chainsByValue, assetGroups, totalValue } = usePortfolio();

  if (!isConnected) return null;

  const hasAssets = !isLoading && (assetGroups.length > 0 || totalValue > 0);

  return (
    <div style={{
      border: "1px solid rgba(232,163,58,0.1)",
      borderLeft: "3px solid rgba(232,163,58,0.4)",
      borderRadius: 4,
      background: "rgba(22,19,16,0.5)",
      overflow: "hidden",
    }}>
      {/* Header row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 18px",
        borderBottom: "1px solid rgba(232,163,58,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, fontWeight: 500, letterSpacing: "0.22em", textTransform: "uppercase", color: "#4A3A2A" }}>
            Cross-Rollup Portfolio
          </span>
          {hasAssets && totalValue > 0 && (
            <span style={{ fontFamily: "var(--font-chakra), sans-serif", fontSize: 18, fontWeight: 700, color: "#F0E8DC", letterSpacing: "-0.02em" }}>
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={btn}
            onClick={() => openDeposit({ denoms: [] })}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(232,163,58,0.4)"; (e.currentTarget as HTMLButtonElement).style.color = "#E8A33A"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(232,163,58,0.2)"; (e.currentTarget as HTMLButtonElement).style.color = "#9A8A78"; }}
          >
            <Download size={9} />
            Deposit
          </button>
          <button style={btn}
            onClick={() => openWithdraw({ denoms: [] })}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(232,163,58,0.4)"; (e.currentTarget as HTMLButtonElement).style.color = "#E8A33A"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(232,163,58,0.2)"; (e.currentTarget as HTMLButtonElement).style.color = "#9A8A78"; }}
          >
            <Upload size={9} />
            Withdraw
          </button>
          <button style={bridgeBtn}
            onClick={() => openBridge()}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(52,211,153,0.5)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(52,211,153,0.1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(52,211,153,0.25)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(52,211,153,0.05)"; }}
          >
            <ArrowRightLeft size={9} />
            Bridge
          </button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px" }}>
          <Loader2 style={{ width: 12, height: 12, color: "#E8A33A" }} className="animate-spin" />
          <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#4A3A2A", letterSpacing: "0.15em" }}>
            Scanning Interwoven chains…
          </span>
        </div>
      ) : !hasAssets ? (
        <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, color: "#4A3A2A" }}>
            No assets found across 13 rollups
          </span>
          <button style={bridgeBtn} onClick={() => openBridge()}>
            Bridge assets in →
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>

          {/* Chains column */}
          <div style={{ padding: "12px 18px", borderRight: "1px solid rgba(232,163,58,0.04)" }}>
            <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 8, color: "#3A2A1A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 8 }}>
              By Chain
            </div>
            {chainsByValue.slice(0, 6).map((chain) => (
              <div key={chain.chainId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(232,163,58,0.03)" }}>
                <span style={{ fontFamily: "var(--font-chakra), sans-serif", fontSize: 12, color: "#9A8A78" }}>
                  {chain.name}
                </span>
                <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, color: "#7A6A58", fontVariantNumeric: "tabular-nums" }}>
                  ${chain.value.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Assets column */}
          <div style={{ padding: "12px 18px" }}>
            <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 8, color: "#3A2A1A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 8 }}>
              Assets
            </div>
            {assetGroups.slice(0, 6).map((group) => (
              <div key={group.symbol} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(232,163,58,0.03)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  {group.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={group.logoUrl} alt={group.symbol} style={{ width: 14, height: 14, borderRadius: "50%", opacity: 0.85 }} />
                  )}
                  <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, fontWeight: 600, color: "#E8A33A" }}>
                    {group.symbol}
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#5A4A38", fontVariantNumeric: "tabular-nums" }}>
                  {group.totalValue != null && group.totalValue > 0
                    ? `$${group.totalValue.toFixed(2)}`
                    : Number(group.totalAmount).toFixed(4)
                  }
                </span>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
