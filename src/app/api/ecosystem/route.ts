import { NextResponse } from "next/server";
import { fetchEcosystemData } from "@/lib/initia-registry";
import { fetchAllMinitiaMetrics } from "@/lib/minitia-api";
import { fetchL1Data, fetchProposals } from "@/lib/l1-api";
import { EcosystemOverview } from "@/lib/types";
import { computeAllPulseScores } from "@/lib/pulse-score";
import type { NetworkMode } from "@/lib/initia-client";

export const revalidate = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const network = (searchParams.get("network") === "mainnet" ? "mainnet" : "testnet") as NetworkMode;

  try {
    const [{ minitias, ibcChannels }, l1Data, proposalData] = await Promise.all([
      fetchEcosystemData(network),
      fetchL1Data(network),
      fetchProposals(10, network),
    ]);

    const minitiasWith = await fetchAllMinitiaMetrics(minitias);

    // Compute Pulse Scores for all minitias
    const scores = computeAllPulseScores(minitiasWith, ibcChannels);
    for (const m of minitiasWith) {
      m.pulseScore = scores.get(m.chainId);
    }

    const activeProposals = proposalData.proposals.filter(
      (p) => p.status === "PROPOSAL_STATUS_VOTING_PERIOD"
    ).length;

    const l1ChainId = network === "mainnet" ? "interwoven-1" : "initiation-2";

    const overview: EcosystemOverview = {
      l1: {
        chainId: l1ChainId,
        blockHeight: l1Data.blockHeight,
        totalTxCount: l1Data.txCount,
        latestBlockTx: l1Data.latestBlockTx,
        recentBlocks: l1Data.recentBlocks,
        validators: l1Data.validators,
        totalValidators: l1Data.totalValidators,
        activeProposals,
        proposals: proposalData.proposals,
      },
      minitias: minitiasWith,
      bridges: l1Data.bridges,
      ibcChannels,
      totalMinitias: minitiasWith.length,
      totalIbcChannels: ibcChannels.length,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Ecosystem error:", error);
    return NextResponse.json({ error: "Failed to fetch ecosystem data" }, { status: 500 });
  }
}
