/**
 * POST /api/oracle
 * Writes the current ecosystem snapshot to PulseOracle on initia-pulse-1.
 * Called by a cron job every 5 minutes (or manually via admin).
 *
 * Auth: If ORACLE_SECRET is set, the x-oracle-secret header must match.
 * If ORACLE_SECRET is not set (local dev), writes are allowed without auth.
 *
 * Requires PULSE_ORACLE_PRIVATE_KEY + PULSE_ORACLE_ADDRESS in .env.local
 * to sign and broadcast the on-chain write.
 */

import { NextResponse } from "next/server";
import { fetchEcosystemData } from "@/lib/initia-registry";
import { fetchAllMinitiaMetrics } from "@/lib/minitia-api";
import { fetchL1Data } from "@/lib/l1-api";
import { generateInsights } from "@/lib/ai";
import { readOracleData, dumpCacheToFile } from "@/lib/oracle-reader";
import { EcosystemOverview } from "@/lib/types";

function healthToUint8(health: string): number {
  if (health === "thriving") return 3;
  if (health === "growing" || health === "stable") return 2;
  if (health === "critical") return 1;
  return 0;
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-oracle-secret");
  const expectedSecret = process.env.ORACLE_SECRET;

  // Require secret only when ORACLE_SECRET is configured (production).
  // In local dev (ORACLE_SECRET not set), allow all writes.
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const oracleAddr = process.env.PULSE_ORACLE_ADDRESS;
  const privateKey = process.env.PULSE_ORACLE_PRIVATE_KEY;
  const rpcUrl = process.env.PULSE_EVM_RPC ?? "http://127.0.0.1:8545";
  const chainId = process.env.PULSE_EVM_CHAIN_ID ?? "2150269405855764";

  if (!oracleAddr || !privateKey) {
    return NextResponse.json(
      { error: "PULSE_ORACLE_ADDRESS and PULSE_ORACLE_PRIVATE_KEY must be set in .env.local" },
      { status: 503 }
    );
  }

  try {
    // 1. Fetch current ecosystem data
    const [{ minitias, ibcChannels }, l1Raw] = await Promise.all([
      fetchEcosystemData(),
      fetchL1Data(),
    ]);
    const minitiasWith = await fetchAllMinitiaMetrics(minitias);

    const ecosystemData: EcosystemOverview = {
      totalMinitias: minitiasWith.length,
      totalIbcChannels: ibcChannels.length,
      minitias: minitiasWith,
      ibcChannels,
      bridges: l1Raw.bridges,
      l1: {
        chainId: "initiation-2",
        blockHeight: l1Raw.blockHeight,
        totalTxCount: l1Raw.txCount,
        recentBlocks: l1Raw.recentBlocks,
        validators: l1Raw.validators,
        totalValidators: l1Raw.totalValidators,
        activeProposals: 0,
        proposals: [],
      },
      lastUpdated: new Date().toISOString(),
    };

    // 2. Generate AI insights — always real (oracle snapshots must have live data)
    const insights = await generateInsights(ecosystemData, true);

    // 3. Prepare on-chain snapshot parameters
    const liveMinitias = minitiasWith.filter(m => (m.metrics?.blockHeight ?? 0) > 0);
    const transferChannels = ibcChannels.filter(c => c.portId === "transfer");

    const blockHeight = l1Raw.blockHeight;
    const activeMinitias = liveMinitias.length;
    const ibcCount = transferChannels.length;
    const totalValidators = l1Raw.totalValidators;
    const activeProposals = 0;
    const totalTxCount = l1Raw.txCount;
    const healthUint = healthToUint8(insights.ecosystem_health);
    const brief = insights.daily_brief.slice(0, 400);

    // 4. Write to PulseOracle via ethers.js
    const { ethers } = await import("ethers");

    const network = ethers.Network.from(Number(chainId));
    const provider = new ethers.JsonRpcProvider(rpcUrl, network, { staticNetwork: network });

    const wallet = new ethers.Wallet(
      privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`,
      provider
    );

    const abi = [
      "function writeSnapshot(uint32 _blockHeight, uint32 _activeMinitias, uint32 _ibcChannels, uint32 _totalValidators, uint32 _activeProposals, uint64 _totalTxCount, uint8 _ecosystemHealth, string calldata _brief) external",
      "function snapshotCount() view returns (uint256)",
    ];

    const oracle = new ethers.Contract(oracleAddr, abi, wallet);

    const tx = await oracle.writeSnapshot(
      blockHeight,
      activeMinitias,
      ibcCount,
      totalValidators,
      activeProposals,
      totalTxCount,
      healthUint,
      brief,
      { gasPrice: 0 }
    );

    const receipt = await tx.wait();
    const newCount = await oracle.snapshotCount();

    // Re-read oracle data to update cache, then dump to file for cold-start persistence
    try {
      await readOracleData();
      await dumpCacheToFile();
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      snapshotId: newCount.toString(),
      snapshot: {
        blockHeight,
        activeMinitias,
        ibcChannels: ibcCount,
        totalValidators,
        totalTxCount,
        ecosystemHealth: insights.ecosystem_health,
        brief: brief.slice(0, 80) + "…",
      },
    });
  } catch (err) {
    console.error("[PulseOracle] write failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET — read the latest on-chain snapshot
export async function GET() {
  const oracleAddr = process.env.PULSE_ORACLE_ADDRESS;

  if (!oracleAddr) {
    return NextResponse.json({ error: "PULSE_ORACLE_ADDRESS not set" }, { status: 503 });
  }

  try {
    const data = await readOracleData();

    return NextResponse.json({
      snapshotCount: data.snapshotCount,
      onChain: true,
      chain: "initia-pulse-1",
      oracle: oracleAddr,
      empty: data.snapshotCount === "0",
      latest: data.latest
        ? { ...data.latest, ecosystemHealth: data.healthLabel }
        : null,
      history: data.history,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isOffline = msg.includes("ECONNREFUSED") || msg.includes("network") || msg.includes("timeout");
    return NextResponse.json(
      {
        error: isOffline
          ? "initia-pulse-1 EVM node is offline — start Docker/Colima to enable on-chain reads"
          : msg,
        onChain: false,
        chain: "initia-pulse-1",
        oracle: oracleAddr,
      },
      { status: isOffline ? 503 : 500 }
    );
  }
}
