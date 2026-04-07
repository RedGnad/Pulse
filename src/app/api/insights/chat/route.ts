import { NextRequest, NextResponse } from "next/server";
import { fetchEcosystemData } from "@/lib/initia-registry";
import { fetchAllMinitiaMetrics } from "@/lib/minitia-api";
import { fetchL1Data, fetchUserBalance, fetchUserDelegations, resolveInitUsername, fetchProposals } from "@/lib/l1-api";
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
    const { message, history = [], mode = "widget", network: networkParam, userAddress, username } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

    const network = (networkParam ?? "testnet") as NetworkMode;

    const [{ minitias, ibcChannels }, l1Raw] = await Promise.all([
      fetchEcosystemData(network),
      fetchL1Data(network),
    ]);

    // Fetch user's staking delegations if they ask about their funds
    const isWalletQuery = /\b(my|mes|mon|ma|nos|notre|j'ai)\b.*\b(fund|fond|stak|delega|balanc|solde|token|init|wallet|portefeuille)\b/i.test(message)
      || /\b(staké|staked|délégué|delegated)\b/i.test(message)
      || /\b(where|où|combien).*(stak|fond|fund|init|balanc|solde)/i.test(message)
      || /\b(balance|solde|wallet|portefeuille)\b/i.test(message)
      || /\b(ai.je|j'ai|a.t.on)\b.*\b(fond|fund|init|token|stak)/i.test(message);
    let walletContext = "";
    if (isWalletQuery && userAddress) {
      const [balances, delegations] = await Promise.all([
        fetchUserBalance(userAddress, network),
        fetchUserDelegations(userAddress, l1Raw.validators, network),
      ]);

      const balanceLines = balances
        .filter(b => parseFloat(b.amount) > 0)
        .map(b => {
          const amt = b.denom === "uinit"
            ? `${(parseFloat(b.amount) / 1_000_000).toFixed(2)} INIT`
            : `${b.amount} ${b.denom}`;
          return `- ${amt}`;
        });

      const delegationLines = delegations.map(d => {
        const amt = (parseFloat(d.amount) / 1_000_000).toFixed(2);
        return `- ${amt} ${d.denom === "uinit" ? "INIT" : d.denom} staked on **${d.validatorMoniker}**`;
      });

      const identity = username ? `@${username} (${userAddress})` : userAddress;
      walletContext = `\n\n[USER WALLET DATA — ${identity}]`
        + `\nAvailable balance:\n${balanceLines.length > 0 ? balanceLines.join("\n") : "- No tokens found"}`
        + `\nStaking positions:\n${delegationLines.length > 0 ? delegationLines.join("\n") : "- No active staking positions"}\n`;
    }
    const minitiasWith = await fetchAllMinitiaMetrics(minitias);

    // Compute Pulse Scores
    const scores = computeAllPulseScores(minitiasWith, ibcChannels);
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

    // Fetch governance proposals if user asks about governance/voting
    const isGovQuery = /\b(governance|proposal|vote|voting|gouvernance|proposition|voter)\b/i.test(message);
    let govContext = "";
    if (isGovQuery) {
      try {
        const { proposals } = await fetchProposals(20, network);
        const active = proposals.filter(p => p.status === "PROPOSAL_STATUS_VOTING_PERIOD");
        if (active.length > 0) {
          govContext = `\n\n[ACTIVE GOVERNANCE PROPOSALS]\n` +
            active.map(p => `- Proposal #${p.id}: "${p.title}" — voting ends ${p.voting_end_time}`).join("\n") +
            `\n\nUsers can vote from Ask Pulse by saying "vote yes on proposal #ID". Votes are executed via PulseGov.sol on the Pulse EVM rollup, which uses the ICosmos precompile to relay the vote to Initia L1 governance.\n`;
        } else {
          govContext = `\n\n[GOVERNANCE] No proposals currently in voting period on ${network === "mainnet" ? "mainnet" : "testnet"}.\n`;
        }
      } catch { /* non-critical */ }
    }

    const isMainnet = network === "mainnet";
    const augmentedMessage = walletContext
      ? message + walletContext + govContext
      : govContext
        ? message + govContext
        : isMainnet && /\b(send|stake|bridge|envoie|delegate|staker)\b/i.test(message)
          ? message + "\n\n[SYSTEM NOTE: User is in MAINNET mode. On-chain actions (send, stake, bridge) are only available on testnet. Inform the user they need to switch to testnet mode to execute transactions.]"
          : message;
    const response = await chatWithEcosystem(augmentedMessage, history, ecosystemData, mode === "full");
    // Only return executable actions on testnet
    let action = isMainnet ? null : parseActionIntent(message, ecosystemData.l1.validators);
    // Resolve .init username → address for send actions
    if (action?.params.recipientUsername) {
      const resolved = await resolveInitUsername(action.params.recipientUsername, network);
      if (resolved) {
        action.params.recipient = resolved;
        action.description = `Transfer ${action.params.amount} INIT to @${action.params.recipientUsername}.init (${resolved.slice(0, 12)}...)`;
      } else {
        // Username not found — drop the action, AI response will explain
        action = null;
      }
    }
    return NextResponse.json({ response, action });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Failed to process query" }, { status: 500 });
  }
}
