"use client";

import { useInterwovenKit } from "@initia/interwovenkit-react";
import { ArrowDownUp } from "lucide-react";

const SRC_CHAIN_ID = "initiation-2";
const SRC_DENOM = "uinit";

export function BridgeWidget() {
  const { address, openBridge, openConnect } = useInterwovenKit();

  const handleBridge = () => {
    if (!address) {
      openConnect();
      return;
    }
    openBridge({ srcChainId: SRC_CHAIN_ID, srcDenom: SRC_DENOM });
  };

  return (
    <button
      onClick={handleBridge}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 20px",
        border: "1px solid rgba(0,255,136,0.25)",
        borderRadius: 6,
        background: "rgba(0,255,136,0.06)",
        cursor: "pointer",
        fontFamily: "var(--font-chakra), sans-serif",
        fontSize: 13,
        fontWeight: 600,
        color: "#00FF88",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        const b = e.currentTarget;
        b.style.background = "rgba(0,255,136,0.12)";
        b.style.borderColor = "rgba(0,255,136,0.4)";
      }}
      onMouseLeave={(e) => {
        const b = e.currentTarget;
        b.style.background = "rgba(0,255,136,0.06)";
        b.style.borderColor = "rgba(0,255,136,0.25)";
      }}
    >
      <ArrowDownUp size={14} />
      Bridge Assets
    </button>
  );
}
