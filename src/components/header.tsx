"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useNetwork } from "@/contexts/network-context";

function useClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => setTime(new Date().toISOString().replace("T", " ").slice(0, 19));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function WalletButton() {
  const { address, username, openConnect, openWallet } = useInterwovenKit();
  const isConnected = !!address;

  const display = username
    ? `@${username}`
    : address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  return (
    <button
      onClick={isConnected ? openWallet : openConnect}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "7px 14px",
        border: isConnected
          ? "1px solid rgba(0,255,136,0.3)"
          : "1px solid rgba(0,255,136,0.15)",
        borderRadius: 4,
        background: isConnected ? "rgba(0,255,136,0.06)" : "rgba(0,255,136,0.03)",
        cursor: "pointer",
        fontFamily: "var(--font-jetbrains), monospace",
        fontSize: 11,
        color: isConnected ? "#00FF88" : "#5A7A8A",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.borderColor = isConnected ? "rgba(0,255,136,0.5)" : "rgba(0,255,136,0.35)";
        b.style.color = "#00FF88";
      }}
      onMouseLeave={e => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.borderColor = isConnected ? "rgba(0,255,136,0.3)" : "rgba(0,255,136,0.15)";
        b.style.color = isConnected ? "#00FF88" : "#5A7A8A";
      }}
    >
      <span style={{
        display: "block", width: 6, height: 6, borderRadius: "50%",
        background: isConnected ? "#00FF88" : "rgba(0,255,136,0.3)",
        boxShadow: isConnected ? "0 0 6px #00FF88" : "none",
        flexShrink: 0,
      }} />
      <span>{isConnected ? (display ?? "Connected") : "Connect Wallet"}</span>
    </button>
  );
}

function NetworkToggle() {
  const { network, toggle, isMainnet } = useNetwork();
  return (
    <button
      onClick={toggle}
      title={`Switch to ${isMainnet ? "testnet" : "mainnet"}`}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "5px 10px",
        border: `1px solid ${isMainnet ? "rgba(255,184,0,0.25)" : "rgba(0,255,136,0.12)"}`,
        borderRadius: 4,
        background: isMainnet ? "rgba(255,184,0,0.06)" : "rgba(0,255,136,0.03)",
        cursor: "pointer",
        transition: "all 0.25s",
      }}
    >
      {/* Toggle track */}
      <div style={{
        position: "relative", width: 28, height: 14, borderRadius: 7,
        background: isMainnet ? "rgba(255,184,0,0.3)" : "rgba(0,255,136,0.2)",
        transition: "background 0.25s",
      }}>
        <div style={{
          position: "absolute", top: 2, width: 10, height: 10, borderRadius: "50%",
          background: isMainnet ? "#FFB800" : "#00FF88",
          boxShadow: `0 0 6px ${isMainnet ? "#FFB800" : "#00FF88"}`,
          left: isMainnet ? 16 : 2,
          transition: "left 0.25s, background 0.25s",
        }} />
      </div>
      <span style={{
        fontFamily: "var(--font-jetbrains), monospace",
        fontSize: 9, fontWeight: 600,
        letterSpacing: "0.1em", textTransform: "uppercase",
        color: isMainnet ? "#FFB800" : "#5A7A8A",
        transition: "color 0.25s",
        minWidth: 52,
      }}>
        {network}
      </span>
    </button>
  );
}

export function Header() {
  const pathname = usePathname();
  const time = useClock();
  const { isMainnet } = useNetwork();

  return (
    <header style={{
      position: "relative", zIndex: 50,
      borderBottom: "1px solid rgba(0,255,136,0.06)",
      background: "rgba(4,10,15,0.94)",
      backdropFilter: "blur(24px)",
    }}>
      <div style={{
        maxWidth: 1280, margin: "0 auto",
        height: 60, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 28px",
      }}>

        {/* Brand */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          {/* Logo mark */}
          <div style={{
            position: "relative",
            width: 34, height: 34, borderRadius: 7,
            background: "rgba(0,255,136,0.04)",
            border: "1px solid rgba(0,255,136,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg viewBox="0 0 28 18" width={22} height={14} fill="none" style={{ display: "block" }}>
              {/* Static ECG trace — clean PQRST */}
              <polyline
                points="0,9 5,9 7,9 9,4 11,15 12.5,6 14,9 18,9 20,7.5 22,10.5 24,9 28,9"
                stroke="#00FF88" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"
                opacity={0.65}
              />
            </svg>
            {/* Ping — radiating pulse on heartbeat rhythm */}
            <span style={{
              position: "absolute", inset: 0, borderRadius: 7,
              border: "1px solid #00FF88",
              animation: "header-ping 2.8s cubic-bezier(0, 0, 0.2, 1) infinite",
              pointerEvents: "none",
            }} />
          </div>
          <div>
            <div style={{
              fontFamily: "var(--font-chakra), sans-serif",
              fontSize: 16, fontWeight: 700,
              color: "#E0F0FF", letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}>
              Initia Pulse
            </div>
            <div style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 10, color: "#3A5A6A", letterSpacing: "0.1em",
              lineHeight: 1,
            }}>
              On-Chain Intelligence
            </div>
          </div>
        </Link>

        {/* Nav + Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span className="nav-links" style={{ display: "contents" }}>
            <NavLink href="/" active={pathname === "/" || pathname.startsWith("/act")} step="01">Act</NavLink>
            <NavLink
              href="/proof"
              active={pathname.startsWith("/proof") || pathname.startsWith("/oracle") || pathname.startsWith("/gate")}
              step="02"
            >
              Proof
            </NavLink>
            <NavLink href="/ask" active={pathname === "/ask"} highlight glow step="">
              <Sparkles style={{ width: 12, height: 12 }} />
              Ask Pulse
            </NavLink>
          </span>

          <div style={{ width: 1, height: 18, background: "rgba(0,255,136,0.08)", margin: "0 8px" }} />

          <NetworkToggle />

          <WalletButton />

          {/* Live indicator */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            marginLeft: 6, padding: "6px 10px",
            border: `1px solid ${isMainnet ? "rgba(255,184,0,0.12)" : "rgba(0,255,136,0.12)"}`, borderRadius: 4,
            background: isMainnet ? "rgba(255,184,0,0.03)" : "rgba(0,255,136,0.03)",
            transition: "all 0.25s",
          }}>
            <span style={{
              display: "block", width: 6, height: 6, borderRadius: "50%",
              background: isMainnet ? "#FFB800" : "#00FF88",
              boxShadow: `0 0 8px ${isMainnet ? "#FFB800" : "#00FF88"}`,
              animation: "pulse-glow-green 2s infinite",
            }} />
            <span style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 10, fontWeight: 500,
              color: isMainnet ? "#FFB800" : "#00FF88",
              letterSpacing: "0.1em",
            }}>
              Live
            </span>
          </div>

          {time && (
            <span className="hide-mobile" style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 10, color: "#1E3040", letterSpacing: "0.08em",
              marginLeft: 8, fontVariantNumeric: "tabular-nums",
            }}>
              {time.slice(11)} UTC
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, active, highlight, glow, step, children }: {
  href: string; active: boolean; highlight?: boolean; glow?: boolean; step?: string; children: React.ReactNode
}) {
  return (
    <Link href={href} style={{
      position: "relative",
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "6px 12px",
      fontFamily: "var(--font-chakra), sans-serif",
      fontSize: 13, fontWeight: 500,
      textDecoration: "none",
      color: active
        ? "#E0F0FF"
        : glow
        ? "#00FF88"
        : highlight
        ? "rgba(0,255,136,0.6)"
        : "#5A7A8A",
      transition: "color 0.15s",
      borderRadius: 4,
      background: active
        ? "rgba(0,255,136,0.06)"
        : glow && !active
        ? "rgba(0,255,136,0.05)"
        : highlight && !active
        ? "rgba(0,255,136,0.03)"
        : "transparent",
      border: glow && !active
        ? "1px solid rgba(0,255,136,0.2)"
        : highlight && !active
        ? "1px solid rgba(0,255,136,0.08)"
        : "1px solid transparent",
      boxShadow: glow && !active ? "0 0 16px rgba(0,255,136,0.08)" : "none",
    }}>
      {step && (
        <span style={{
          fontFamily: "var(--font-jetbrains), monospace",
          fontSize: 8, fontWeight: 700,
          color: active ? "#00FF88" : "rgba(0,255,136,0.3)",
          letterSpacing: "0.05em",
        }}>
          {step}
        </span>
      )}
      {children}
    </Link>
  );
}
