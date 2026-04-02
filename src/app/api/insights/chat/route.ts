import { NextRequest, NextResponse } from "next/server";
import { fetchEcosystemData } from "@/lib/initia-registry";
import { fetchAllMinitiaMetrics } from "@/lib/minitia-api";
import { fetchL1Data, fetchUserDelegations } from "@/lib/l1-api";
import { chatWithEcosystem } from "@/lib/ai";
import { EcosystemOverview } from "@/lib/types";
import { computeAllPulseScores } from "@/lib/pulse-score";
import { parseActionIntent } from "@/lib/action-parser";
import type { NetworkMode } from "@/contexts/network-context";

export async function POST(req: NextRequest) {
  const aiKey = process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  if (!aiKey || aiKey === "your_api_key_here") {
    return NextResponse.json({ error: "AI API key not configured. Set AI_API_KEY (or ANTHROPIC_API_KEY / OPENAI_API_KEY) in .env.local" }, { status: 503 });
  }

  try {
    const { message, history = [], mode = "widget", network: networkParam, userAddress } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

    const network = (networkParam ?? "testnet") as NetworkMode;

    const [{ minitias, ibcChannels }, l1Raw] = await Promise.all([
      fetchEcosystemData(network),
      fetchL1Data(network),
    ]);

    // Fetch user's staking delegations if they ask about their funds
    const isWalletQuery = /\b(my|mes|mon|ma|nos|notre)\b.*\b(fund|fond|stak|delega|balanc|solde|token|init)\b/i.test(message)
      || /\b(staké|staked|délégué|delegated)\b/i.test(message)
      || /\b(where|où|combien).*(stak|fond|fund|init)/i.test(message);
    let walletContext = "";
    if (isWalletQuery && userAddress) {
      const delegations = await fetchUserDelegations(userAddress, l1Raw.validators, network);
      if (delegations.length > 0) {
        const lines = delegations.map(d => {
          const amt = (parseFloat(d.amount) / 1_000_000).toFixed(2);
          return `- ${amt} ${d.denom === "uinit" ? "INIT" : d.denom} staked on **${d.validatorMoniker}**`;
        });
        walletContext = `\n\n[USER WALLET DATA — address: ${userAddress}]\nStaking positions:\n${lines.join("\n")}\n`;
      } else {
        walletContext = `\n\n[USER WALLET DATA — address: ${userAddress}]\nNo active staking positions found.\n`;
      }
    }
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

    const augmentedMessage = walletContext ? message + walletContext : message;
    const response = await chatWithEcosystem(augmentedMessage, history, ecosystemData, mode === "full");
    const action = parseActionIntent(message, ecosystemData.l1.validators);
    return NextResponse.json({ response, action });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Failed to process query" }, { status: 500 });
  }
}
