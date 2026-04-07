"use client";

import { useState, useEffect, useCallback } from "react";
import { useNetwork } from "@/contexts/network-context";
import { Proposal } from "@/lib/types";
import {
  Vote, Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
} from "lucide-react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { initiaPulse } from "@/lib/wagmi-config";
import { useInterwovenKit } from "@initia/interwovenkit-react";

// PulseGov deployed on initia-pulse-1
const PULSE_GOV_ADDRESS = "0x0000000000000000000000000000000000000000"; // TODO: set after deployment
const PULSE_GOV_ABI = [
  {
    name: "vote",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint64" },
      { name: "option", type: "uint8" },
    ],
    outputs: [],
  },
] as const;

const VOTE_OPTIONS = [
  { value: 1, label: "Yes", color: "#00FF88" },
  { value: 2, label: "Abstain", color: "#5A7A8A" },
  { value: 3, label: "No", color: "#FF3366" },
  { value: 4, label: "Veto", color: "#FFB800" },
] as const;

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function timeLeft(endTime: string) {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h left`;
  return `${hours}h left`;
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const { address } = useInterwovenKit();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);

  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId: initiaPulse.id,
  });

  useEffect(() => {
    if (isSuccess) setVoted(true);
  }, [isSuccess]);

  const handleVote = useCallback(() => {
    if (!selectedOption) return;
    writeContract({
      address: PULSE_GOV_ADDRESS as `0x${string}`,
      abi: PULSE_GOV_ABI,
      functionName: "vote",
      args: [BigInt(proposal.id), selectedOption],
      chainId: initiaPulse.id,
    });
  }, [selectedOption, proposal.id, writeContract]);

  return (
    <div style={{
      border: "1px solid rgba(0,255,136,0.1)",
      borderRadius: 8,
      background: "rgba(4,10,15,0.8)",
      padding: 24,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <span style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 10, color: "#00FF88", letterSpacing: "0.1em",
          }}>
            #{proposal.id}
          </span>
          <h3 style={{
            fontFamily: "var(--font-chakra), sans-serif",
            fontSize: 16, fontWeight: 600, color: "#E0F0FF",
            margin: "4px 0 8px",
            lineHeight: 1.3,
          }}>
            {proposal.title}
          </h3>
        </div>
        <span style={{
          fontFamily: "var(--font-jetbrains), monospace",
          fontSize: 10, color: "#FFB800",
          padding: "3px 8px",
          border: "1px solid rgba(255,184,0,0.2)",
          borderRadius: 4,
          background: "rgba(255,184,0,0.06)",
          whiteSpace: "nowrap",
        }}>
          {timeLeft(proposal.voting_end_time)}
        </span>
      </div>

      {/* Dates */}
      <div style={{
        display: "flex", gap: 24, marginBottom: 20,
        fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#3A5A6A",
      }}>
        <span>Submitted: {formatDate(proposal.submit_time)}</span>
        <span>Voting ends: {formatDate(proposal.voting_end_time)}</span>
      </div>

      {/* Vote buttons */}
      {!voted ? (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {VOTE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelectedOption(opt.value)}
                style={{
                  padding: "8px 16px",
                  border: `1px solid ${selectedOption === opt.value ? opt.color : "rgba(90,122,138,0.2)"}`,
                  borderRadius: 4,
                  background: selectedOption === opt.value ? `${opt.color}11` : "transparent",
                  color: selectedOption === opt.value ? opt.color : "#5A7A8A",
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleVote}
            disabled={!selectedOption || !address || isPending || isConfirming}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 20px",
              border: "1px solid rgba(0,255,136,0.3)",
              borderRadius: 4,
              background: "rgba(0,255,136,0.06)",
              color: (!selectedOption || !address) ? "#3A5A6A" : "#00FF88",
              fontFamily: "var(--font-chakra), sans-serif",
              fontSize: 13, fontWeight: 600,
              cursor: (!selectedOption || !address) ? "not-allowed" : "pointer",
              opacity: (!selectedOption || !address) ? 0.5 : 1,
              transition: "all 0.15s",
            }}
          >
            {isPending || isConfirming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Vote className="h-4 w-4" />
            )}
            {!address
              ? "Connect wallet to vote"
              : isPending
              ? "Signing..."
              : isConfirming
              ? "Confirming..."
              : "Vote from Pulse"}
          </button>

          {error && (
            <div style={{
              marginTop: 8, display: "flex", alignItems: "center", gap: 6,
              fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#FF3366",
            }}>
              <XCircle className="h-3 w-3" />
              {error.message.slice(0, 120)}
            </div>
          )}

          {!address && (
            <p style={{
              marginTop: 8,
              fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#3A5A6A",
            }}>
              Vote on Initia L1 governance from this EVM rollup via ICosmos precompile
            </p>
          )}
        </div>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          color: "#00FF88",
          fontFamily: "var(--font-jetbrains), monospace", fontSize: 12,
        }}>
          <CheckCircle2 className="h-4 w-4" />
          Vote submitted on-chain
        </div>
      )}
    </div>
  );
}

export default function GovernancePage() {
  const { network } = useNetwork();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/governance?network=${network}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProposals(data.proposals ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch proposals");
    } finally {
      setLoading(false);
    }
  }, [network]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <main style={{
      maxWidth: 900, margin: "0 auto", padding: "40px 24px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-chakra), sans-serif",
            fontSize: 24, fontWeight: 700, color: "#E0F0FF",
            marginBottom: 4,
          }}>
            Governance
          </h1>
          <p style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 11, color: "#3A5A6A", letterSpacing: "0.05em",
          }}>
            Vote on Initia L1 proposals from the Pulse rollup via ICosmos precompile
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px",
            border: "1px solid rgba(0,255,136,0.15)",
            borderRadius: 4,
            background: "rgba(0,255,136,0.03)",
            color: "#5A7A8A",
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 11,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 60, color: "#3A5A6A",
        }}>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span style={{
            marginLeft: 10,
            fontFamily: "var(--font-jetbrains), monospace", fontSize: 12,
          }}>
            Fetching proposals from Initia L1...
          </span>
        </div>
      ) : error ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "16px 20px",
          border: "1px solid rgba(255,51,102,0.2)",
          borderRadius: 8,
          background: "rgba(255,51,102,0.04)",
          color: "#FF3366",
          fontFamily: "var(--font-jetbrains), monospace", fontSize: 12,
        }}>
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      ) : proposals.length === 0 ? (
        <div style={{
          textAlign: "center", padding: 60,
          border: "1px solid rgba(0,255,136,0.06)",
          borderRadius: 8,
          background: "rgba(4,10,15,0.6)",
        }}>
          <Vote className="h-8 w-8" style={{ color: "#1E3040", margin: "0 auto 12px" }} />
          <p style={{
            fontFamily: "var(--font-chakra), sans-serif",
            fontSize: 14, color: "#5A7A8A",
          }}>
            No active proposals in voting period
          </p>
          <p style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 10, color: "#3A5A6A", marginTop: 4,
          }}>
            Proposals will appear here when a vote is open on Initia L1
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {proposals.map(p => (
            <ProposalCard key={p.id} proposal={p} />
          ))}
        </div>
      )}

      {/* Explainer */}
      <div style={{
        marginTop: 40, padding: "16px 20px",
        border: "1px solid rgba(0,255,136,0.06)",
        borderRadius: 8,
        background: "rgba(4,10,15,0.4)",
      }}>
        <p style={{
          fontFamily: "var(--font-jetbrains), monospace",
          fontSize: 10, color: "#3A5A6A", lineHeight: 1.6,
        }}>
          <strong style={{ color: "#5A7A8A" }}>How it works:</strong> PulseGov.sol uses the ICosmos precompile
          (0x...f1) to execute a Cosmos MsgVote from this EVM rollup. Your vote is relayed to Initia L1
          governance — a native Initia capability that demonstrates the Interwoven architecture.
        </p>
      </div>
    </main>
  );
}
