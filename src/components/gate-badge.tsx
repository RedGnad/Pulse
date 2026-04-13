"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";

const MONO = "var(--font-jetbrains), monospace";

interface GateStatus {
  deposit: { allowed: boolean; reason: string };
  emergencyMode: boolean;
  healthLabel: string;
  healthStreak: number;
  source: "contract" | "derived";
}

/**
 * GateBadge — surfaces the live PulseGate signal on any page.
 * Mirrors the same check contracts/PulseGate.sol enforces on-chain,
 * so users see the same gate that any consuming contract would see
 * before an action is broadcast.
 */
export function GateBadge() {
  const [status, setStatus] = useState<GateStatus | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/api/gate", { cache: "no-store" })
        .then(r => r.ok ? r.json() : null)
        .then(s => { if (alive && s && !s.error) setStatus(s); })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 20_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!status) {
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "6px 12px", borderRadius: 4,
        border: "1px solid rgba(90,122,138,0.2)",
        background: "rgba(10,18,24,0.6)",
        fontFamily: MONO, fontSize: 11, color: "#5A7A8A",
      }}>
        <Loader2 className="animate-spin" style={{ width: 11, height: 11 }} />
        Reading Pulse gate…
      </div>
    );
  }

  const allowed = status.deposit.allowed;
  const color = allowed ? "#00FF88" : "#FF3366";
  const Icon = allowed ? ShieldCheck : ShieldAlert;

  return (
    <Link href="/gate" style={{ textDecoration: "none" }}>
      <div
        title={status.deposit.reason}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 12px", borderRadius: 4,
          border: `1px solid ${color}33`,
          background: `${color}08`,
          fontFamily: MONO, fontSize: 11, color, cursor: "pointer",
          letterSpacing: "0.05em",
        }}
      >
        <Icon style={{ width: 12, height: 12 }} />
        <span style={{ fontWeight: 600 }}>
          Pulse Gate: {allowed ? "ALLOW" : "BLOCK"}
        </span>
        <span style={{ color: "#5A7A8A" }}>·</span>
        <span style={{ color: "#8AB4C8" }}>
          {status.healthLabel} · streak {status.healthStreak}
        </span>
      </div>
    </Link>
  );
}
