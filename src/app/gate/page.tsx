"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck, ShieldAlert, Loader2, CheckCircle2, XCircle,
  ArrowRight, Code2,
} from "lucide-react";

const MONO = "var(--font-jetbrains), monospace";
const SANS = "var(--font-chakra), sans-serif";

interface ThresholdCheck {
  minHealth: number;
  minStreak: number;
  passes: boolean;
  label: string;
  description: string;
}

interface GateStatus {
  source: "contract" | "derived";
  contractAddress: string | null;
  oracleAddress: string | null;
  deposit: { allowed: boolean; reason: string; requirement: string };
  emergencyMode: boolean;
  healthLabel: string;
  healthStreak: number;
  snapshotCount: string;
  thresholds: ThresholdCheck[];
}

async function fetchGate(): Promise<GateStatus> {
  const res = await fetch("/api/gate", { cache: "no-store" });
  if (!res.ok) throw new Error(`gate unavailable (${res.status})`);
  return res.json();
}

export default function GatePage() {
  const [status, setStatus] = useState<GateStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchGate()
        .then(s => { if (alive) { setStatus(s); setError(null); } })
        .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    };
    load();
    const id = setInterval(load, 15_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const allowed = status?.deposit.allowed ?? false;
  const accent = allowed ? "#00FF88" : "#FF3366";

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 28px 80px" }}>

      {/* Hero */}
      <section style={{ marginBottom: 32 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#00D4FF", padding: "5px 12px", borderRadius: 4,
          background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)",
          marginBottom: 16,
        }}>
          <ShieldCheck style={{ width: 12, height: 12 }} />
          PulseGate — composable risk primitive
        </div>
        <h1 style={{
          fontFamily: SANS, fontSize: 40, fontWeight: 800, color: "#E0F0FF",
          margin: "0 0 12px", letterSpacing: "-0.02em", lineHeight: 1.1,
        }}>
          Any contract can subscribe to the Pulse signal.
        </h1>
        <p style={{
          fontFamily: MONO, fontSize: 13, color: "#8AB4C8",
          margin: 0, lineHeight: 1.6, maxWidth: 720,
        }}>
          PulseGate is a 30-line Solidity primitive that reads the PulseOracle and gates
          any action based on a configurable risk threshold. A treasury wants conservative
          checks, a swap wants the default, a failsafe wants emergency-only — same signal,
          different appetites. Below is the live evaluation of all three presets.
        </p>
      </section>

      {error && (
        <div style={{
          padding: 16, marginBottom: 24,
          border: "1px solid rgba(255,51,102,0.3)", borderRadius: 8,
          background: "rgba(255,51,102,0.05)",
          fontFamily: MONO, fontSize: 12, color: "#FF3366",
        }}>
          Gate unavailable: {error}
        </div>
      )}

      {!status && !error && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 24, fontFamily: MONO, fontSize: 13, color: "#5A7A8A" }}>
          <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
          Reading gate state…
        </div>
      )}

      {status && (
        <>
          {/* Summary card */}
          <section style={{
            padding: 24, marginBottom: 20,
            borderRadius: 10,
            border: `1px solid ${accent}33`,
            background: `linear-gradient(135deg, ${accent}08, rgba(4,10,15,0.4))`,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5A7A8A" }}>
                Live oracle state
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: "#3A5A6A" }}>
                {status.source === "contract"
                  ? `↳ on-chain read · ${status.contractAddress?.slice(0, 8)}…${status.contractAddress?.slice(-6)}`
                  : "↳ server-side mirror of contracts/PulseGate.sol against the live Oracle"}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <Metric label="Health label" value={status.healthLabel} color="#00D4FF" />
              <Metric label="Streak @ growing+" value={`${status.healthStreak} snaps`} color="#00FF88" />
              <Metric label="Snapshots on-chain" value={status.snapshotCount} color="#A78BFA" />
              <Metric label="Emergency mode" value={status.emergencyMode ? "YES" : "no"} color={status.emergencyMode ? "#FF3366" : "#5A7A8A"} />
            </div>
          </section>

          {/* Threshold presets — the actual product */}
          <section style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: "#E0F0FF", marginBottom: 4 }}>
              Gate evaluation — three risk appetites
            </div>
            <p style={{ fontFamily: MONO, fontSize: 12, color: "#5A7A8A", margin: "0 0 14px", lineHeight: 1.6 }}>
              Each consumer contract picks its own <code style={{ color: "#00D4FF" }}>isHealthy(minHealth, minStreak)</code> thresholds.
              Below is the live verdict for three common presets.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {status.thresholds.map(t => (
                <ThresholdRow key={t.label} check={t} />
              ))}
            </div>
          </section>

          {/* Contract source */}
          <section style={{
            padding: 22, marginBottom: 24,
            borderRadius: 10,
            border: "1px solid rgba(0,212,255,0.08)",
            background: "rgba(10,18,24,0.6)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Code2 style={{ width: 14, height: 14, color: "#00D4FF" }} />
              <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: "#E0F0FF" }}>
                contracts/PulseGate.sol
              </span>
            </div>
            <pre style={{
              margin: 0, padding: 14, borderRadius: 6,
              background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.04)",
              fontFamily: MONO, fontSize: 11, color: "#8AB4C8",
              lineHeight: 1.7, overflowX: "auto",
            }}>
{`interface IPulseOracle {
  function isHealthy(uint8 minHealth, uint256 minStreak)
    external view returns (bool);
}

contract PulseGate {
  IPulseOracle public oracle;

  function gatedDeposit() external {
    require(oracle.isHealthy(2, 3), "PulseGate: ecosystem health too low");
    emit ActionExecuted(msg.sender, "deposit", block.timestamp);
  }
}`}
            </pre>
          </section>

          {/* Cross-link to Ask Pulse */}
          <Link href="/" style={{ textDecoration: "none" }}>
            <section style={{
              padding: "18px 22px", borderRadius: 10,
              border: "1px solid rgba(0,255,136,0.15)",
              background: "linear-gradient(135deg, rgba(0,255,136,0.04), rgba(0,212,255,0.02))",
              display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
            }}>
              <ShieldAlert style={{ width: 20, height: 20, color: "#00FF88", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: "#E0F0FF" }}>
                  The same signal guards every route
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: "#8AB4C8", marginTop: 3 }}>
                  Describe what you want to do and Pulse checks per-rollup risks before letting the tx proceed.
                </div>
              </div>
              <ArrowRight style={{ width: 14, height: 14, color: "#00FF88", opacity: 0.6 }} />
            </section>
          </Link>
        </>
      )}
    </div>
  );
}

function ThresholdRow({ check }: { check: ThresholdCheck }) {
  const passes = check.passes;
  const color = passes ? "#00FF88" : "#FF3366";
  const Icon = passes ? CheckCircle2 : XCircle;
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 8,
      border: `1px solid ${color}25`,
      background: `linear-gradient(90deg, ${color}06, rgba(10,18,24,0.4))`,
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <Icon style={{ width: 20, height: 20, color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
          <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: "#E0F0FF", textTransform: "capitalize" }}>
            {check.label.replace("-", " ")}
          </span>
          <span style={{
            fontFamily: MONO, fontSize: 10, color: "#5A7A8A",
            padding: "1px 6px", borderRadius: 3,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
          }}>
            isHealthy({check.minHealth}, {check.minStreak})
          </span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: "#8AB4C8", lineHeight: 1.5 }}>
          {check.description}
        </div>
      </div>
      <span style={{
        fontFamily: MONO, fontSize: 11, fontWeight: 700, color,
        padding: "4px 10px", borderRadius: 4,
        background: `${color}12`, border: `1px solid ${color}30`,
        letterSpacing: "0.1em", flexShrink: 0,
      }}>
        {passes ? "ALLOW" : "BLOCK"}
      </span>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5A7A8A", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  );
}
