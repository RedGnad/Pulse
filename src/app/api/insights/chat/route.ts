import { NextRequest, NextResponse } from "next/server";
import { fetchEcosystemData } from "@/lib/initia-registry";
import { fetchAllMinitiaMetrics } from "@/lib/minitia-api";
import { fetchL1Data } from "@/lib/l1-api";
import { chatWithEcosystem } from "@/lib/ai";
import { EcosystemOverview } from "@/lib/types";
import { computeAllPulseScores } from "@/lib/pulse-score";
import type { NetworkMode } from "@/contexts/network-context";

export async function POST(req: NextRequest) {
  const aiKey = process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  if (!aiKey || aiKey === "your_api_key_here") {
    return NextResponse.json({ error: "AI API key not configured. Set AI_API_KEY (or ANTHROPIC_API_KEY / OPENAI_API_KEY) in .env.local" }, { status: 503 });
  }

  try {
    const { message, history = [], mode = "widget", network: networkParam } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

    const network = (networkParam ?? "testnet") as NetworkMode;

    const [{ minitias, ibcChannels }, l1Raw] = await Promise.all([
      fetchEcosystemData(network),
      fetchL1Data(network),
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
        chainId: network === "mainnet" ? "interwoven-1" : "initiation-2",
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
