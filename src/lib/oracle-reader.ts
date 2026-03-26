/**
 * Server-side Oracle reader — shared by api/oracle and api/advisor routes.
 * Reads snapshots from the PulseOracle contract on initia-pulse-1 (EVM).
 */

export interface OracleHistoryEntry {
  timestamp: string;
  blockHeight: number;
  activeMinitilas: number;
  ibcChannels: number;
  totalValidators: number;
  totalTxCount: number;
  ecosystemHealth: string;
  brief: string;
}

const HEALTH_LABELS: Record<number, string> = {
  3: "thriving",
  2: "growing",
  1: "critical",
  0: "unknown",
};

type RawSnap = {
  timestamp: bigint;
  blockHeight: number;
  activeMinitilas: number;
  ibcChannels: number;
  totalValidators: number;
  totalTxCount: bigint;
  ecosystemHealth: number;
  brief: string;
};

const HISTORY_ABI = [
  "function snapshotCount() view returns (uint256)",
  "function healthLabel() view returns (string)",
  "function getHistory() view returns (tuple(uint256 timestamp, uint32 blockHeight, uint32 activeMinitilas, uint32 ibcChannels, uint32 totalValidators, uint32 activeProposals, uint64 totalTxCount, uint8 ecosystemHealth, string brief)[10])",
];

function parseRaw(raw: RawSnap[]): OracleHistoryEntry[] {
  return raw
    .filter(s => Number(s.timestamp) > 0)
    .map(s => ({
      timestamp: s.timestamp.toString(),
      blockHeight: Number(s.blockHeight),
      activeMinitilas: Number(s.activeMinitilas),
      ibcChannels: Number(s.ibcChannels),
      totalValidators: Number(s.totalValidators),
      totalTxCount: Number(s.totalTxCount),
      ecosystemHealth: HEALTH_LABELS[Number(s.ecosystemHealth)] ?? "unknown",
      brief: s.brief,
    }))
    .reverse(); // newest first
}

function getEnv() {
  return {
    oracleAddr: process.env.PULSE_ORACLE_ADDRESS,
    rpcUrl: process.env.PULSE_EVM_RPC ?? "http://127.0.0.1:8545",
    chainId: process.env.PULSE_EVM_CHAIN_ID ?? "2150269405855764",
  };
}

export interface FullOracleData {
  snapshotCount: string;
  latest: OracleHistoryEntry | null;
  history: OracleHistoryEntry[];
  healthLabel: string;
}

/** Read full oracle data (snapshot count, history, health label). */
export async function readOracleData(): Promise<FullOracleData> {
  const { oracleAddr, rpcUrl, chainId } = getEnv();
  if (!oracleAddr) throw new Error("PULSE_ORACLE_ADDRESS not set");

  const { ethers } = await import("ethers");
  const network = ethers.Network.from(Number(chainId));
  const provider = new ethers.JsonRpcProvider(rpcUrl, network, { staticNetwork: network });
  const oracle = new ethers.Contract(oracleAddr, HISTORY_ABI, provider);

  const [count, label, rawHistory] = await Promise.all([
    oracle.snapshotCount() as Promise<bigint>,
    oracle.healthLabel() as Promise<string>,
    oracle.getHistory() as Promise<RawSnap[]>,
  ]);

  if (Number(count) === 0) {
    return { snapshotCount: "0", latest: null, history: [], healthLabel: label };
  }

  const history = parseRaw(rawHistory);
  return {
    snapshotCount: count.toString(),
    latest: history[0] ?? null,
    history,
    healthLabel: label,
  };
}

/**
 * Lightweight read — only fetches history, with timeout.
 * Returns null if the chain is offline (graceful degradation).
 */
export async function readOracleHistory(timeoutMs = 2500): Promise<OracleHistoryEntry[] | null> {
  const { oracleAddr, rpcUrl, chainId } = getEnv();
  if (!oracleAddr) return null;

  try {
    const { ethers } = await import("ethers");
    const network = ethers.Network.from(Number(chainId));
    const provider = new ethers.JsonRpcProvider(rpcUrl, network, { staticNetwork: network });

    const abi = [
      "function getHistory() view returns (tuple(uint256 timestamp, uint32 blockHeight, uint32 activeMinitilas, uint32 ibcChannels, uint32 totalValidators, uint32 activeProposals, uint64 totalTxCount, uint8 ecosystemHealth, string brief)[10])",
    ];
    const oracle = new ethers.Contract(oracleAddr, abi, provider);

    const rawHistory = await Promise.race([
      oracle.getHistory() as Promise<RawSnap[]>,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("oracle timeout")), timeoutMs)
      ),
    ]);

    return parseRaw(rawHistory);
  } catch {
    return null;
  }
}
