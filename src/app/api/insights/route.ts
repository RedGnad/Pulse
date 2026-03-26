import { NextResponse } from "next/server";
import { fetchEcosystemData } from "@/lib/initia-registry";
import { fetchAllMinitiaMetrics } from "@/lib/minitia-api";
import { fetchL1Data } from "@/lib/l1-api";
import { generateInsights } from "@/lib/ai";
import { EcosystemOverview } from "@/lib/types";

export const revalidate = 300;

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your_api_key_here") {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured. Add it to .env.local" },
      { status: 503 }
    );
  }

  try {
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

    const insights = await generateInsights(ecosystemData);
    return NextResponse.json({ insights, ecosystem: ecosystemData });
  } catch (error) {
    console.error("Insights generation error:", error);
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
  }
}
