"use client";

import { useState, useEffect } from "react";
import { useOracle } from "@/hooks/use-oracle";
import { useChainStatus } from "@/hooks/use-chain-status";
import { useNetwork } from "@/contexts/network-context";
import { SnapshotEntry } from "@/hooks/use-oracle";
import {
  Database,
  Zap,
  RefreshCw,
  Activity,
  ExternalLink,
  Code2,
  CheckCircle2,
  Clock,
  Cpu,
  Radio,
  AlertCircle,
  Satellite,
  Brain,
  Link2,
  HardDrive,
  Search,
  ChevronDown,
  Copy,
  Check,
  ShieldCheck,
  Info,
} from "lucide-react";
import { SnapshotCountdown } from "@/components/snapshot-countdown";

const ORACLE_ADDR = process.env.NEXT_PUBLIC_PULSE_ORACLE_ADDRESS ?? "0xc09F200B0d98ca2b21761aFA191FEdb55a9AA4B4";
const CHAIN_ID = "initia-pulse-1";
const EVM_ID = "2150269405855764";

const HEALTH_CFG = {
  thriving: {
    color: "#00FF88",
    bg: "rgba(0,255,136,0.06)",
    border: "rgba(0,255,136,0.2)",
    label: "THRIVING",
    score: 4,
  },
  growing: {
    color: "#00D4FF",
    bg: "rgba(0,212,255,0.06)",
    border: "rgba(0,212,255,0.2)",
    label: "GROWING",
    score: 3,
  },
  stable: {
    color: "#5A7A8A",
    bg: "rgba(90,122,138,0.06)",
    border: "rgba(90,122,138,0.2)",
    label: "STABLE",
    score: 2,
  },
  critical: {
    color: "#FF3366",
    bg: "rgba(255,51,102,0.06)",
    border: "rgba(255,51,102,0.2)",
    label: "CRITICAL",
    score: 1,
  },
  unknown: {
    color: "#3A5A6A",
    bg: "rgba(0,0,0,0.1)",
    border: "rgba(30,48,64,0.2)",
    label: "UNKNOWN",
    score: 0,
  },
};

function mono(s: React.ReactNode, size = 12, color = "#8AB4C8") {
  return (
    <span
      style={{
        fontFamily: "var(--font-jetbrains), monospace",
        fontSize: size,
        color,
      }}
    >
      {s}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-jetbrains), monospace",
        fontSize: 11,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: "#1E3040",
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(0,255,136,0.06)",
        borderRadius: 4,
        background: "rgba(10,18,24,0.6)",
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function HealthSparkline({ history }: { history: SnapshotEntry[] }) {
  if (history.length < 2) return null;
  const W = 280,
    H = 52,
    PAD = 6;
  const scores = history.map(
    (s) => HEALTH_CFG[s.ecosystemHealth as keyof typeof HEALTH_CFG]?.score ?? 0,
  );
  const pts = scores.map((s, i) => {
    const x = PAD + (i / (scores.length - 1)) * (W - PAD * 2);
    const y = H - PAD - (s / 4) * (H - PAD * 2);
    return [x, y] as [number, number];
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = [
    ...pts.map(([x, y]) => `${x},${y}`),
    `${W - PAD},${H}`,
    `${PAD},${H}`,
  ].join(" ");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {mono("Health over time", 11, "#3A5A6A")}
        {mono(`${history.length} snapshots`, 11, "#1E3040")}
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: "block", height: H }}
      >
        {[1, 2, 3, 4].map((v) => {
          const y = H - PAD - (v / 4) * (H - PAD * 2);
          return (
            <line
              key={v}
              x1={PAD}
              y1={y}
              x2={W - PAD}
              y2={y}
              stroke="rgba(0,255,136,0.04)"
              strokeWidth="1"
            />
          );
        })}
        <polyline points={area} fill="rgba(0,255,136,0.04)" stroke="none" />
        <polyline
          points={line}
          fill="none"
          stroke="rgba(0,255,136,0.4)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {pts.map(([x, y], i) => {
          const cfg =
            HEALTH_CFG[history[i].ecosystemHealth as keyof typeof HEALTH_CFG] ??
            HEALTH_CFG.unknown;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={i === history.length - 1 ? 3 : 2}
              fill={cfg.color}
              opacity={i === history.length - 1 ? 1 : 0.6}
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {mono("oldest", 11, "#1E3040")}
        {mono("latest", 11, "#1E3040")}
      </div>
    </div>
  );
}

function useNextWrite(lastTimestamp: string | undefined) {
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    const tick = () => {
      if (!lastTimestamp || lastTimestamp === "0") {
        setCountdown("—");
        return;
      }
      const remaining = Math.max(
        0,
        Number(lastTimestamp) * 1000 + 300_000 - Date.now(),
      );
      if (remaining === 0) {
        setCountdown("now");
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastTimestamp]);
  return countdown;
}

function SnapshotHistory({
  history,
  isOffline,
}: {
  history: SnapshotEntry[];
  isOffline: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (history.length === 0) return null;
  const visible = expanded ? history : history.slice(0, 5);
  const hasMore = history.length > 5;

  return (
    <Card style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <Clock style={{ width: 11, height: 11, color: "#00FF88" }} />
        {mono("Snapshot History", 11, "rgba(0,255,136,0.6)")}
        {mono(
          isOffline
            ? `${history.length} demo records`
            : `${history.length} records on-chain`,
          11,
          isOffline ? "rgba(0,212,255,0.4)" : "#3A5A6A",
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {visible.map((snap, i) => {
          const hh =
            HEALTH_CFG[snap.ecosystemHealth as keyof typeof HEALTH_CFG] ??
            HEALTH_CFG.unknown;
          const ts =
            Number(snap.timestamp) > 0
              ? new Date(Number(snap.timestamp) * 1000).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "—";
          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "100px 110px 100px 75px 1fr",
                alignItems: "center",
                gap: 12,
                padding: "8px 12px",
                background: i === 0 ? "rgba(0,255,136,0.02)" : "transparent",
                border:
                  i === 0
                    ? "1px solid rgba(0,255,136,0.06)"
                    : "1px solid transparent",
                borderRadius: 2,
              }}
            >
              {mono(ts, 11, i === 0 ? "#5A7A8A" : "#3A5A6A")}
              <span
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  padding: "2px 6px",
                  borderRadius: 1,
                  color: hh.color,
                  background: hh.bg,
                  border: `1px solid ${hh.border}`,
                }}
              >
                {hh.label}
              </span>
              {mono(`blk ${snap.blockHeight.toLocaleString()}`, 11, "#3A5A6A")}
              {mono(`${snap.activeMinitilas} live`, 11, "#3A5A6A")}
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11,
                  color: "#3A5A6A",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {snap.brief
                  ? snap.brief.slice(0, 90) +
                    (snap.brief.length > 90 ? "…" : "")
                  : "—"}
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginTop: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 0",
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 11,
            color: "#5A7A8A",
          }}
        >
          <ChevronDown
            style={{
              width: 10,
              height: 10,
              transition: "transform 0.2s",
              transform: expanded ? "rotate(180deg)" : "rotate(0)",
            }}
          />
          {expanded ? "Show less" : `Show all ${history.length} snapshots`}
        </button>
      )}
    </Card>
  );
}

function CodeExamples({ oracleAddr }: { oracleAddr: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ borderTop: "2px solid rgba(0,255,136,0.15)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <Code2 style={{ width: 11, height: 11, color: "#00FF88" }} />
        {mono(
          "Composable Integration — Code Examples",
          11,
          "rgba(0,255,136,0.6)",
        )}
        <div
          style={{ flex: 1, height: 1, background: "rgba(0,255,136,0.06)" }}
        />
        <ChevronDown
          style={{
            width: 12,
            height: 12,
            color: "#5A7A8A",
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0)",
          }}
        />
      </button>
      <p
        style={{
          margin: "8px 0 0",
          fontFamily: "var(--font-jetbrains), monospace",
          fontSize: 12,
          color: "#5A7A8A",
          lineHeight: 1.6,
        }}
      >
        Any smart contract on Initia can call PulseOracle to get the current
        state of the ecosystem — composable{" "}
        <strong style={{ color: "#00FF88" }}>infrastructure</strong>, not just a
        dashboard.
      </p>

      {open && (
        <div style={{ marginTop: 16, animation: "fade-in 0.2s ease-out" }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div
              style={{
                borderRadius: 4,
                overflow: "hidden",
                border: "1px solid rgba(0,255,136,0.1)",
              }}
            >
              <div
                style={{
                  padding: "8px 14px",
                  background: "rgba(0,255,136,0.04)",
                  borderBottom: "1px solid rgba(0,255,136,0.06)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {mono(
                  "Solidity — Read from your contract",
                  11,
                  "rgba(0,255,136,0.45)",
                )}
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: "14px 16px",
                  background: "rgba(0,0,0,0.3)",
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11,
                  color: "#3A6A5A",
                  lineHeight: 1.7,
                  overflowX: "auto",
                  whiteSpace: "pre",
                }}
              >{`interface IPulseOracle {
  struct Snapshot {
    uint256 timestamp;
    uint32  blockHeight;
    uint32  activeMinitias;
    uint32  ibcChannels;
    uint32  totalValidators;
    uint32  activeProposals;
    uint64  totalTxCount;
    uint8   ecosystemHealth;
    bytes32 dataHash;  // integrity proof
    string  brief;
  }
  function latest()
    external view returns (Snapshot memory);
  function getSnapshot(uint256 index)
    external view returns (Snapshot memory);
  function getHistory()
    external view returns (Snapshot[50] memory);
  function healthStreak(uint8 minHealth)
    external view returns (uint256);
  function isHealthy(uint8 minHealth, uint256 minStreak)
    external view returns (bool);
  function healthLabel()
    external view returns (string memory);
  function isWriter(address)
    external view returns (bool);
}

// Usage — DeFi health gate:
IPulseOracle oracle = IPulseOracle(
  ${oracleAddr}
);
require(oracle.isHealthy(2, 10),
  "ecosystem unstable — lending paused");

// Verify data integrity off-chain:
bytes32 expected = keccak256(abi.encodePacked(rawData));
require(s.dataHash == expected, "data tampered");`}</pre>
            </div>

            <div
              style={{
                borderRadius: 4,
                overflow: "hidden",
                border: "1px solid rgba(0,212,255,0.1)",
              }}
            >
              <div
                style={{
                  padding: "8px 14px",
                  background: "rgba(0,212,255,0.03)",
                  borderBottom: "1px solid rgba(0,212,255,0.06)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {mono(
                  "ethers.js — Read from your dApp",
                  11,
                  "rgba(0,212,255,0.45)",
                )}
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: "14px 16px",
                  background: "rgba(0,0,0,0.3)",
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11,
                  color: "#3A6A5A",
                  lineHeight: 1.7,
                  overflowX: "auto",
                  whiteSpace: "pre",
                }}
              >{`import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(
  "https://rpc.initia-pulse-1.initia.xyz"
);

const oracle = new ethers.Contract(
  "${oracleAddr}",
  [
    "function latest() view returns (...)",
    "function snapshotCount() view returns (uint256)",
  ],
  provider
);

const snap = await oracle.latest();
console.log(snap.brief);
// → "Initia ecosystem thriving..."
console.log(snap.activeMinitias);
// → 6`}</pre>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

interface TxReceipt {
  blockNumber: string;
  gasUsed: string;
  status: string;
  to: string;
  from: string;
}

const EVM_RPC =
  process.env.NEXT_PUBLIC_PULSE_JSON_RPC ?? "http://localhost:8545";

function TxSuccess({ txHash }: { txHash: string }) {
  const [copied, setCopied] = useState(false);
  const [receipt, setReceipt] = useState<TxReceipt | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Auto-verify on mount
  useEffect(() => {
    verifyOnChain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txHash]);

  function handleCopy() {
    navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function verifyOnChain() {
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch(EVM_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getTransactionReceipt",
          params: [txHash],
          id: 1,
        }),
      });
      const json = await res.json();
      if (json.result) {
        setReceipt(json.result);
      } else {
        setVerifyError("Transaction not found — it may still be pending.");
      }
    } catch {
      setVerifyError("Could not reach rollup RPC. Is the node running?");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 4,
        background: "rgba(0,255,136,0.04)",
        border: "1px solid rgba(0,255,136,0.12)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <CheckCircle2
          style={{ width: 12, height: 12, color: "#00FF88", flexShrink: 0 }}
        />
        {mono("Snapshot written on-chain", 12, "#00FF88")}
      </div>

      {/* EVM tx hash — full, copiable */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderRadius: 3,
          background: "rgba(0,0,0,0.2)",
          border: "1px solid rgba(0,255,136,0.06)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 11,
            color: "#5A7A8A",
            flexShrink: 0,
          }}
        >
          EVM TX
        </span>
        <span
          style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 11,
            color: "#8AB4C8",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            userSelect: "all",
          }}
        >
          {txHash}
        </span>
        <button
          onClick={handleCopy}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            borderRadius: 3,
            border: copied
              ? "1px solid rgba(0,255,136,0.3)"
              : "1px solid rgba(0,255,136,0.1)",
            background: copied
              ? "rgba(0,255,136,0.08)"
              : "rgba(0,255,136,0.03)",
            cursor: "pointer",
            flexShrink: 0,
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 11,
            color: copied ? "#00FF88" : "#5A7A8A",
            transition: "all 0.15s",
          }}
        >
          {copied ? (
            <>
              <Check style={{ width: 10, height: 10 }} /> Copied
            </>
          ) : (
            <>
              <Copy style={{ width: 10, height: 10 }} /> Copy
            </>
          )}
        </button>
      </div>

      {/* Verify button + receipt */}
      {!receipt && (
        <button
          onClick={verifyOnChain}
          disabled={verifying}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            alignSelf: "flex-start",
            padding: "5px 12px",
            borderRadius: 3,
            border: "1px solid rgba(0,255,136,0.15)",
            background: "rgba(0,255,136,0.04)",
            cursor: verifying ? "wait" : "pointer",
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 11,
            color: "#00FF88",
            transition: "all 0.15s",
          }}
        >
          <ShieldCheck style={{ width: 11, height: 11 }} />
          {verifying ? "Querying RPC…" : "Verify on-chain"}
        </button>
      )}

      {verifyError && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <AlertCircle style={{ width: 10, height: 10, color: "#FF3366" }} />
          {mono(verifyError, 11, "#FF3366")}
        </div>
      )}

      {receipt && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 3,
            background: "rgba(0,255,136,0.02)",
            border: "1px solid rgba(0,255,136,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <ShieldCheck style={{ width: 11, height: 11, color: "#00FF88" }} />
            {mono("Verified — transaction confirmed on-chain", 11, "#00FF88")}
          </div>
          {[
            {
              l: "Status",
              v: receipt.status === "0x1" ? "Success" : "Failed",
              c: receipt.status === "0x1" ? "#00FF88" : "#FF3366",
            },
            {
              l: "Block",
              v: String(parseInt(receipt.blockNumber, 16)),
              c: "#8AB4C8",
            },
            {
              l: "Gas Used",
              v: parseInt(receipt.gasUsed, 16).toLocaleString(),
              c: "#5A7A8A",
            },
            {
              l: "Contract",
              v: `${receipt.to.slice(0, 10)}…${receipt.to.slice(-6)}`,
              c: "#5A7A8A",
            },
            {
              l: "From",
              v: `${receipt.from.slice(0, 10)}…${receipt.from.slice(-6)}`,
              c: "#5A7A8A",
            },
          ].map(({ l, v, c }) => (
            <div
              key={l}
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              {mono(l, 11, "#3A5A6A")}
              {mono(v, 11, c)}
            </div>
          ))}
          <div style={{ marginTop: 4 }}>
            {mono(`Chain: ${CHAIN_ID} · RPC: ${EVM_RPC}`, 11, "#3A5A6A")}
          </div>
        </div>
      )}

      {/* Context note + explorer link */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <a
          href={`https://scan.testnet.initia.xyz/initiation-2/txs`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 12px",
            borderRadius: 3,
            border: "1px solid rgba(0,255,136,0.12)",
            background: "rgba(0,255,136,0.03)",
            textDecoration: "none",
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 11,
            color: "#5A7A8A",
            transition: "all 0.15s",
          }}
        >
          <ExternalLink style={{ width: 10, height: 10 }} />
          Initia Explorer
        </a>
        {mono(
          "Rollup EVM tx — not on public explorer, verified via RPC above",
          11,
          "#3A5A6A",
        )}
      </div>
    </div>
  );
}

export default function OraclePage() {
  const { data, isLoading, error, refetch } = useOracle();
  const { data: chain } = useChainStatus();
  const { isMainnet } = useNetwork();
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const isOffline = !!error || (!isLoading && !data);
  const isDemo = isMainnet; // Oracle runs on testnet rollup — mainnet shows demo/preview
  const displayHistory: SnapshotEntry[] = data?.history ?? [];
  const displayLatest: SnapshotEntry | null = data?.latest ?? null;

  const nextWrite = useNextWrite(displayLatest?.timestamp);

  async function writeNow() {
    setWriting(true);
    setWriteError(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000); // 90s max
      const res = await fetch("/api/oracle", { method: "POST", signal: controller.signal });
      clearTimeout(timeout);
      const json = await res.json();
      if (json.success) {
        setLastTx(json.txHash);
        refetch();
      } else setWriteError(json.error ?? "Write failed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Write failed";
      setWriteError(msg.includes("abort") ? "Write timed out — try again" : msg);
    } finally {
      setWriting(false);
    }
  }

  const h = displayLatest
    ? (HEALTH_CFG[displayLatest.ecosystemHealth as keyof typeof HEALTH_CFG] ??
      HEALTH_CFG.unknown)
    : null;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      <main
        style={{
          position: "relative",
          zIndex: 10,
          margin: "0 auto",
          width: "100%",
          maxWidth: 1200,
          padding: "28px 28px 80px",
          flex: 1,
        }}
      >
        {/* ── Header ─── */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <Database style={{ width: 14, height: 14, color: "#00FF88" }} />
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-chakra), sans-serif",
                fontSize: 36,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                background: "linear-gradient(90deg, #00FF88, #00D4FF)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              PulseOracle
            </h1>
            {h && (
              <span
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11,
                  letterSpacing: "0.15em",
                  padding: "3px 10px",
                  borderRadius: 2,
                  color: h.color,
                  background: h.bg,
                  border: `1px solid ${h.border}`,
                }}
              >
                {h.label}
              </span>
            )}
            <div
              style={{
                flex: 1,
                height: 1,
                background:
                  "linear-gradient(90deg, rgba(0,255,136,0.08), transparent)",
              }}
            />
            {!isOffline && nextWrite && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 12px",
                  border: "1px solid rgba(0,255,136,0.06)",
                  borderRadius: 2,
                }}
              >
                <Clock style={{ width: 10, height: 10, color: "#3A5A6A" }} />
                {mono(`next: ${nextWrite}`, 11, "#3A5A6A")}
              </div>
            )}
            <button
              onClick={writeNow}
              disabled={writing || isDemo}
              title={
                isDemo ? "Switch to testnet to write snapshots" : undefined
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                border: `1px solid ${isDemo ? "rgba(90,122,138,0.15)" : "rgba(0,255,136,0.25)"}`,
                borderRadius: 2,
                background: isDemo
                  ? "rgba(90,122,138,0.04)"
                  : "rgba(0,255,136,0.04)",
                cursor: writing || isDemo ? "not-allowed" : "pointer",
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: 11,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: writing || isDemo ? "#3A5A6A" : "#00FF88",
                transition: "all 0.12s",
                opacity: isDemo ? 0.5 : 1,
              }}
            >
              {writing ? (
                <>
                  <RefreshCw
                    style={{ width: 10, height: 10 }}
                    className="animate-spin"
                  />{" "}
                  Writing…
                </>
              ) : (
                <>
                  <Zap style={{ width: 10, height: 10 }} /> Write Snapshot
                </>
              )}
            </button>
          </div>
          <p
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 14,
              color: "#8AB4C8",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            On-chain intelligence layer running on our own EVM rollup. The AI
            monitors 13+ rollups and writes a live ecosystem snapshot every 5
            minutes — composable, immutable, readable by any smart contract.{" "}
            <SnapshotCountdown
              latestTimestamp={
                data?.latest ? Number(data.latest.timestamp) : null
              }
              color="#6A9AB0"
            />
          </p>
        </div>

        {/* ── Mainnet demo banner ─── */}
        {isDemo && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 16px",
              border: "1px solid rgba(255,184,0,0.12)",
              borderRadius: 3,
              background: "rgba(255,184,0,0.03)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Info
              style={{
                width: 12,
                height: 12,
                color: "rgba(255,184,0,0.5)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: 11,
                color: "#5A7A8A",
              }}
            >
              Testnet oracle preview — switch to testnet for live writes
            </span>
          </div>
        )}

        {/* ── Offline banner ─── */}
        {isOffline && !isDemo && (
          <div
            style={{
              marginBottom: 14,
              padding: "12px 18px",
              border: "1px solid rgba(0,255,136,0.15)",
              borderLeft: "3px solid rgba(0,255,136,0.4)",
              borderRadius: 3,
              background: "rgba(0,255,136,0.02)",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <AlertCircle
              style={{
                width: 14,
                height: 14,
                color: "rgba(0,255,136,0.5)",
                flexShrink: 0,
                marginTop: 1,
              }}
            />
            <div>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  color: "rgba(0,255,136,0.6)",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Rollup not connected
              </div>
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 12,
                  color: "#5A7A8A",
                  lineHeight: 1.65,
                }}
              >
                PulseOracle snapshots will appear here once the EVM rollup is
                deployed on Initia testnet. The architecture and composable
                interface are shown below.
              </p>
            </div>
          </div>
        )}

        {/* ── Our chain live banner ─── */}
        <div
          style={{
            marginBottom: 16,
            padding: "12px 20px",
            border: chain?.isLive
              ? "1px solid rgba(0,255,136,0.15)"
              : "1px solid rgba(30,48,64,0.3)",
            borderLeft: chain?.isLive
              ? "3px solid #00FF88"
              : "3px solid #1E3040",
            borderRadius: 3,
            background: chain?.isLive
              ? "rgba(0,255,136,0.02)"
              : "rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Cpu
              style={{
                width: 11,
                height: 11,
                color: chain?.isLive ? "#00FF88" : "#3A5A6A",
                flexShrink: 0,
              }}
            />
            {mono(CHAIN_ID, 11, chain?.isLive ? "#00FF88" : "#3A5A6A")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                display: "block",
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: chain?.isLive ? "#00FF88" : "#0D1820",
                boxShadow: chain?.isLive ? "0 0 6px #00FF88" : "none",
              }}
            />
            {mono(
              chain === undefined
                ? "Querying…"
                : chain.isLive
                  ? "Block production active"
                  : "Awaiting deployment",
              11,
              chain?.isLive ? "#00FF88" : "#3A5A6A",
            )}
          </div>
          {chain?.isLive && (
            <>
              <div
                style={{
                  width: 1,
                  height: 16,
                  background: "rgba(0,255,136,0.06)",
                }}
              />
              <div>
                <Label>Cosmos Block</Label>
                <div
                  style={{
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#00FF88",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {chain.blockHeight.toLocaleString()}
                </div>
              </div>
              <div>
                <Label>EVM Block</Label>
                <div
                  style={{
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#5A7A8A",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {chain.evmBlockHeight != null
                    ? chain.evmBlockHeight.toLocaleString()
                    : "—"}
                </div>
              </div>
              <div>
                <Label>Last Block</Label>
                <div
                  style={{
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: 13,
                    fontWeight: 700,
                    color: (chain.secondsAgo ?? 99) < 5 ? "#00FF88" : "#FF3366",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {chain.secondsAgo != null ? `${chain.secondsAgo}s ago` : "—"}
                </div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <a
                  href="https://scan.testnet.initia.xyz/initiation-2"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    textDecoration: "none",
                    padding: "4px 8px",
                    border: "1px solid rgba(0,255,136,0.08)",
                    borderRadius: 2,
                  }}
                >
                  <ExternalLink
                    style={{ width: 10, height: 10, color: "#3A5A6A" }}
                  />
                  {mono("L1 Explorer", 11, "#3A5A6A")}
                </a>
              </div>
            </>
          )}
        </div>

        {/* ── Main grid ─── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 16,
          }}
        >
          {/* Latest snapshot */}
          <Card style={{ borderTop: "2px solid rgba(0,255,136,0.35)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity style={{ width: 11, height: 11, color: "#00FF88" }} />
                {mono("Latest On-Chain Snapshot", 11, "rgba(0,255,136,0.6)")}
              </div>
              {data && mono(`#${data.snapshotCount} written`, 11, "#3A5A6A")}
            </div>
            {isLoading && (
              <div style={{ padding: "20px 0", textAlign: "center" }}>
                {mono("Reading chain…", 11, "#0D1820")}
              </div>
            )}
            {!isLoading && data && !data.latest && (
              <div style={{ padding: "20px 0", textAlign: "center" }}>
                {mono(
                  "No snapshots written yet — click Write Snapshot",
                  11,
                  "#3A5A6A",
                )}
              </div>
            )}
            {displayLatest && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {displayLatest.brief && (
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-jetbrains), monospace",
                      fontSize: 13,
                      color: "#8AB4C8",
                      lineHeight: 1.7,
                      padding: "10px 12px",
                      background: "rgba(0,255,136,0.02)",
                      border: "1px solid rgba(0,255,136,0.05)",
                      borderRadius: 3,
                    }}
                  >
                    {displayLatest.brief}
                  </p>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 8,
                  }}
                >
                  {[
                    {
                      l: "L1 Height",
                      v: displayLatest.blockHeight.toLocaleString(),
                    },
                    {
                      l: "Live Chains",
                      v: String(displayLatest.activeMinitilas),
                    },
                    {
                      l: "Validators",
                      v: String(displayLatest.totalValidators),
                    },
                    { l: "IBC Ch.", v: String(displayLatest.ibcChannels) },
                    {
                      l: "Total Txs",
                      v: displayLatest.totalTxCount.toLocaleString(),
                    },
                    {
                      l: "Written at",
                      v:
                        displayLatest.timestamp !== "0"
                          ? new Date(
                              Number(displayLatest.timestamp) * 1000,
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—",
                    },
                  ].map(({ l, v }) => (
                    <div
                      key={l}
                      style={{
                        padding: "8px 10px",
                        background: "rgba(0,255,136,0.015)",
                        border: "1px solid rgba(0,255,136,0.04)",
                        borderRadius: 2,
                      }}
                    >
                      <Label>{l}</Label>
                      <div
                        style={{
                          fontFamily: "var(--font-jetbrains), monospace",
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#8AB4C8",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {v}
                      </div>
                    </div>
                  ))}
                </div>
                {lastTx && <TxSuccess txHash={lastTx} />}
                {writeError && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 10px",
                      background: "rgba(255,51,102,0.04)",
                      border: "1px solid rgba(255,51,102,0.12)",
                      borderRadius: 2,
                    }}
                  >
                    <AlertCircle
                      style={{
                        width: 10,
                        height: 10,
                        color: "#FF3366",
                        flexShrink: 0,
                      }}
                    />
                    {mono(writeError, 11, "#FF3366")}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Right: contract + sparkline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Card>
              <div style={{ marginBottom: 14 }}>
                {mono("Contract", 11, "rgba(0,255,136,0.6)")}
              </div>
              {[
                {
                  l: "Address",
                  v: `${ORACLE_ADDR.slice(0, 10)}…${ORACLE_ADDR.slice(-6)}`,
                },
                { l: "Chain", v: CHAIN_ID },
                { l: "EVM ID", v: EVM_ID },
                { l: "VM", v: "EVM (MiniEVM v1.2.14)" },
                { l: "Snapshots", v: data ? data.snapshotCount : "—" },
                { l: "Gas", v: "0 (free)" },
              ].map(({ l, v }) => (
                <div
                  key={l}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid rgba(0,255,136,0.03)",
                  }}
                >
                  {mono(l, 11, "#3A5A6A")}
                  {mono(String(v), 11, "#5A7A8A")}
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  marginTop: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Database
                    style={{ width: 10, height: 10, color: "#3A5A6A" }}
                  />
                  {mono(
                    "Custom rollup — not yet on public explorer",
                    11,
                    "#3A5A6A",
                  )}
                </div>
                <a
                  href="https://scan.testnet.initia.xyz/initiation-2"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    textDecoration: "none",
                  }}
                >
                  <ExternalLink
                    style={{ width: 10, height: 10, color: "#5A7A8A" }}
                  />
                  {mono("View L1 Explorer", 11, "#5A7A8A")}
                </a>
              </div>
            </Card>

            {displayHistory.length >= 2 && (
              <Card>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 14,
                  }}
                >
                  <Radio style={{ width: 11, height: 11, color: "#00FF88" }} />
                  {mono(
                    "Ecosystem Health — Historical",
                    11,
                    "rgba(0,255,136,0.6)",
                  )}
                  {isOffline && mono("demo", 11, "rgba(0,212,255,0.4)")}
                </div>
                <HealthSparkline history={[...displayHistory].reverse()} />
              </Card>
            )}
          </div>
        </div>

        {/* ── Snapshot history ─── */}
        <SnapshotHistory
          history={displayHistory}
          isOffline={isOffline || isDemo}
        />

        {/* ── Architecture Flow ─── */}
        <Card
          style={{
            borderTop: "2px solid rgba(0,255,136,0.12)",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 24,
            }}
          >
            <Code2 style={{ width: 11, height: 11, color: "#00FF88" }} />
            {mono("How PulseOracle Works", 11, "rgba(0,255,136,0.6)")}
          </div>

          {/* Visual pipeline */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              marginBottom: 24,
            }}
          >
            {[
              {
                n: "01",
                title: "Aggregate",
                icon: <Satellite style={{ width: 18, height: 18 }} />,
                body: "13+ rollup APIs",
                detail: "blocks, txs, IBC, validators",
                color: "#00FF88",
              },
              {
                n: "02",
                title: "Analyze",
                icon: <Brain style={{ width: 18, height: 18 }} />,
                body: "Pulse AI",
                detail: "brief + health score",
                color: "#A78BFA",
              },
              {
                n: "03",
                title: "Write",
                icon: <Link2 style={{ width: 18, height: 18 }} />,
                body: "writeSnapshot()",
                detail: "ethers.js → EVM tx",
                color: "#00D4FF",
              },
              {
                n: "04",
                title: "Store",
                icon: <HardDrive style={{ width: 18, height: 18 }} />,
                body: "On-chain",
                detail: "initia-pulse-1",
                color: "#00D4FF",
              },
              {
                n: "05",
                title: "Read",
                icon: <Search style={{ width: 18, height: 18 }} />,
                body: "latest() / getHistory()",
                detail: "composable by any contract",
                color: "#00FF88",
              },
            ].map((step, i, arr) => (
              <div
                key={step.n}
                style={{ display: "flex", alignItems: "center", flex: 1 }}
              >
                <div
                  style={{
                    flex: 1,
                    padding: "14px 16px",
                    textAlign: "center",
                    border: `1px solid ${step.color}22`,
                    borderRadius: 4,
                    background: `${step.color}08`,
                    animation: `fade-in 0.5s ease ${i * 0.15}s both`,
                  }}
                >
                  <div
                    style={{
                      color: step.color,
                      display: "flex",
                      justifyContent: "center",
                      marginBottom: 6,
                      opacity: 0.8,
                    }}
                  >
                    {step.icon}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-jetbrains), monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: step.color,
                      marginBottom: 4,
                    }}
                  >
                    {step.title}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-jetbrains), monospace",
                      fontSize: 12,
                      color: "#8AB4C8",
                      fontWeight: 600,
                    }}
                  >
                    {step.body}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-jetbrains), monospace",
                      fontSize: 11,
                      color: "#3A5A6A",
                      marginTop: 2,
                    }}
                  >
                    {step.detail}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div
                    style={{
                      padding: "0 4px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                      <path
                        d="M0 6h16M12 1l5 5-5 5"
                        stroke="rgba(0,255,136,0.2)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <animate
                          attributeName="stroke-dashoffset"
                          values="25;0"
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="stroke-dasharray"
                          values="0 25;25 0"
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                      </path>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Cadence */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: "10px 0",
              borderTop: "1px solid rgba(0,255,136,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Clock style={{ width: 11, height: 11, color: "#3A5A6A" }} />
              <SnapshotCountdown
                latestTimestamp={
                  data?.latest ? Number(data.latest.timestamp) : null
                }
              />
            </div>
            <div
              style={{
                width: 1,
                height: 10,
                background: "rgba(0,255,136,0.06)",
              }}
            />
            {mono("Gas: 0 (free)", 11, "#3A5A6A")}
            <div
              style={{
                width: 1,
                height: 10,
                background: "rgba(0,255,136,0.06)",
              }}
            />
            {mono("10 snapshots on-chain history", 11, "#3A5A6A")}
          </div>
        </Card>

        {/* ── Smart Contract Integration ─── */}
        <CodeExamples oracleAddr={ORACLE_ADDR} />
      </main>
    </div>
  );
}
