import { NextResponse } from "next/server";
import { fetchEcosystemData } from "@/lib/initia-registry";
import { fetchAllMinitiaMetrics } from "@/lib/minitia-api";
import { fetchL1Data, fetchProposals } from "@/lib/l1-api";
import { EcosystemOverview } from "@/lib/types";
import { computeAllPulseScores } from "@/lib/pulse-score";

export const revalidate = 30;

export async function GET() {
  try {
    const [{ minitias, ibcChannels }, l1Data, proposalData] = await Promise.all([
      fetchEcosystemData(),
      fetchL1Data(),
      fetchProposals(10),
    ]);

    const minitiasWith = await fetchAllMinitiaMetrics(minitias);

    // Compute Pulse Scores for all minitias
    const scores = computeAllPulseScores(minitiasWith);
    for (const m of minitiasWith) {
      m.pulseScore = scores.get(m.chainId);
    }

    const activeProposals = proposalData.proposals.filter(
      (p) => p.status === "PROPOSAL_STATUS_VOTING_PERIOD"
    ).length;

    const overview: EcosystemOverview = {
      l1: {
        chainId: "initiation-2",
        blockHeight: l1Data.blockHeight,
        totalTxCount: l1Data.txCount,
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
