import { NextRequest, NextResponse } from "next/server";
import { fetchEcosystemData } from "@/lib/initia-registry";
import { fetchAllMinitiaMetrics } from "@/lib/minitia-api";
import { fetchL1Data } from "@/lib/l1-api";
import { chatWithEcosystem } from "@/lib/ai";
import { EcosystemOverview } from "@/lib/types";
import { computeAllPulseScores } from "@/lib/pulse-score";

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your_api_key_here") {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  try {
    const { message, history = [], mode = "widget" } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

    const [{ minitias, ibcChannels }, l1Raw] = await Promise.all([
      fetchEcosystemData(),
      fetchL1Data(),
    ]);
    const minitiasWith = await fetchAllMinitiaMetrics(minitias);

    // Compute Pulse Scores
    const scores = computeAllPulseScores(minitiasWith);
    for (const m of minitiasWith) {
      m.pulseScore = scores.get(m.chainId);
    }

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

    const response = await chatWithEcosystem(message, history, ecosystemData, mode === "full");
    return NextResponse.json({ response });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Failed to process query" }, { status: 500 });
  }
}
