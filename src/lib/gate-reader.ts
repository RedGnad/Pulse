/**
 * PulseGate reader — evaluates the current gate state for the demo.
 *
 * If PULSE_GATE_ADDRESS is set, reads directly from the deployed contract
 * (isHealthy + isEmergencyMode). Otherwise, derives the same signal
 * from the Oracle's latest snapshot by mirroring the gate's on-chain logic,
 * so the UI works end-to-end even before PulseGate is deployed.
 *
 * Gate semantics (see contracts/PulseGate.sol):
 *   allowed        = oracle.isHealthy(2, 3)   // growing health, 3-snapshot streak
 *   emergencyMode  = !oracle.isHealthy(1, 1)  // not even critical for last snapshot
 */

import { readOracleData } from "@/lib/oracle-reader";

export interface ThresholdCheck {
  minHealth: number;       // 1=critical, 2=growing, 3=thriving
  minStreak: number;
  passes: boolean;
  label: string;           // "default", "conservative", "emergency-only"
  description: string;
}

export interface GateStatus {
  source: "contract" | "derived";
  contractAddress: string | null;
  oracleAddress: string | null;
  deposit: {
    allowed: boolean;
    reason: string;
    requirement: string;
  };
  emergencyMode: boolean;
  healthLabel: string;
  healthStreak: number;
  snapshotCount: string;
  latestBrief: string | null;
  latestTimestamp: string | null;
  // Multi-threshold evaluation — shows what any consuming contract would see
  // depending on its configured risk appetite.
  thresholds: ThresholdCheck[];
}

const HEALTH_RANK: Record<string, number> = {
  thriving: 3,
  growing: 2,
  critical: 1,
  unknown: 0,
};

function rank(label: string): number {
  return HEALTH_RANK[label] ?? 0;
}

const THRESHOLD_PRESETS: Array<Omit<ThresholdCheck, "passes">> = [
  { minHealth: 1, minStreak: 1, label: "emergency-only", description: "Block only when the ecosystem drops below critical. Used by failsafe-only contracts." },
  { minHealth: 2, minStreak: 3, label: "default",        description: "Require 3 consecutive snapshots at growing or better. The PulseGate reference setting." },
  { minHealth: 3, minStreak: 10, label: "conservative", description: "Require 10 snapshots at thriving. Used by treasury-grade consumers." },
];

/**
 * Compute the streak of consecutive newest snapshots with health >= minHealth.
 * Mirrors PulseOracle.healthStreak(minHealth) on-chain.
 */
function computeStreak(history: { ecosystemHealth: string }[], minHealth: number): number {
  let streak = 0;
  for (const s of history) {
    if (rank(s.ecosystemHealth) >= minHealth) streak++;
    else break;
  }
  return streak;
}

function evaluateThresholds(history: { ecosystemHealth: string }[]): ThresholdCheck[] {
  return THRESHOLD_PRESETS.map(t => ({
    ...t,
    passes: computeStreak(history, t.minHealth) >= t.minStreak,
  }));
}

async function readFromContract(gateAddr: string): Promise<GateStatus | null> {
  const rpcUrl = process.env.PULSE_EVM_RPC ?? "http://127.0.0.1:8545";
  const chainId = process.env.PULSE_EVM_CHAIN_ID ?? "2150269405855764";

  try {
    const { ethers } = await import("ethers");
    const network = ethers.Network.from(Number(chainId));
    const provider = new ethers.JsonRpcProvider(rpcUrl, network, { staticNetwork: network });

    const gateAbi = [
      "function oracle() view returns (address)",
      "function isEmergencyMode() view returns (bool)",
      "function gatedDeposit()",
    ];
    const oracleAbi = [
      "function isHealthy(uint8 minHealth, uint256 minStreak) view returns (bool)",
      "function healthLabel() view returns (string)",
      "function healthStreak(uint8 minHealth) view returns (uint256)",
      "function snapshotCount() view returns (uint256)",
    ];

    const gate = new ethers.Contract(gateAddr, gateAbi, provider);
    const oracleAddr: string = await gate.oracle();
    const oracle = new ethers.Contract(oracleAddr, oracleAbi, provider);

    // Evaluate every threshold preset against the real on-chain oracle.
    const thresholdResults = await Promise.all(
      THRESHOLD_PRESETS.map(async t => {
        const passes = (await oracle.isHealthy(t.minHealth, t.minStreak)) as boolean;
        return { ...t, passes };
      }),
    );
    const defaultCheck = thresholdResults.find(t => t.label === "default") ?? thresholdResults[0];

    const [emergencyMode, label, streak, count] = await Promise.all([
      gate.isEmergencyMode() as Promise<boolean>,
      oracle.healthLabel() as Promise<string>,
      oracle.healthStreak(2) as Promise<bigint>,
      oracle.snapshotCount() as Promise<bigint>,
    ]);

    // Simulate gatedDeposit() to get the exact revert reason from the deployed contract
    let reason = defaultCheck.passes
      ? "gatedDeposit() passes — ecosystem meets the default gate threshold"
      : "PulseGate: ecosystem health too low";
    try {
      await gate.gatedDeposit.staticCall();
      reason = "gatedDeposit() simulated successfully on-chain — deposit would execute";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const match = msg.match(/reverted with reason string ['"]([^'"]+)['"]/);
      if (match) reason = `on-chain revert: ${match[1]}`;
    }

    return {
      source: "contract",
      contractAddress: gateAddr,
      oracleAddress: oracleAddr,
      deposit: {
        allowed: defaultCheck.passes,
        reason,
        requirement: "oracle.isHealthy(minHealth=2, minStreak=3)",
      },
      emergencyMode,
      healthLabel: label,
      healthStreak: Number(streak),
      snapshotCount: count.toString(),
      latestBrief: null,
      latestTimestamp: null,
      thresholds: thresholdResults,
    };
  } catch (err) {
    console.warn("[gate-reader] contract read failed, falling back to derived:", err);
    return null;
  }
}

interface OracleLike {
  snapshotCount: string;
  latest: { ecosystemHealth: string; brief: string; timestamp: string } | null;
  history: { ecosystemHealth: string }[];
}

async function readOracleOrCache(): Promise<OracleLike> {
  try {
    return await readOracleData();
  } catch {
    // Last resort: load the seeded cache file directly so the demo works
    // end-to-end with zero env config.
    const seed = (await import("@/../data/oracle-cache.json")) as unknown as OracleLike;
    return seed;
  }
}

async function readDerived(): Promise<GateStatus> {
  const oracle = await readOracleOrCache();
  const history = oracle.history; // newest first
  const latest = oracle.latest;

  // healthStreak(2) = number of consecutive newest snapshots with health >= growing (rank >= 2)
  let streak = 0;
  for (const s of history) {
    if (rank(s.ecosystemHealth) >= 2) streak++;
    else break;
  }

  const allowed = streak >= 3;
  const emergencyMode = !latest || rank(latest.ecosystemHealth) < 1;

  return {
    source: "derived",
    contractAddress: null,
    oracleAddress: process.env.PULSE_ORACLE_ADDRESS ?? null,
    deposit: {
      allowed,
      reason: allowed
        ? `ecosystem has been at "${latest?.ecosystemHealth ?? "growing"}" or better for ${streak} consecutive snapshots — PulseGate would permit the action`
        : `PulseGate: ecosystem health too low — current streak at growing+ is ${streak}, needs 3`,
      requirement: "oracle.isHealthy(minHealth=2, minStreak=3)",
    },
    emergencyMode,
    healthLabel: latest?.ecosystemHealth ?? "unknown",
    healthStreak: streak,
    snapshotCount: oracle.snapshotCount,
    latestBrief: latest?.brief ?? null,
    latestTimestamp: latest?.timestamp ?? null,
    thresholds: evaluateThresholds(history),
  };
}

export async function readGateStatus(): Promise<GateStatus> {
  const gateAddr = process.env.PULSE_GATE_ADDRESS;
  if (gateAddr) {
    const fromContract = await readFromContract(gateAddr);
    if (fromContract) return fromContract;
  }
  return readDerived();
}
