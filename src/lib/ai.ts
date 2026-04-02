import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { EcosystemOverview, MinitiaWithMetrics, L1Validator, OpinitBridge, IbcChannel, DeployAdvice, StakeAdvice, BridgeAdvice } from "./types";
import { formatNumber } from "./format";

// ─── Multi-provider AI configuration ─────────────────────────────────────────
// AI_PROVIDER: "anthropic" (default) | "openai" (covers OpenAI, Ollama, LM Studio, Groq, Together, etc.)
// AI_MODEL: model ID to use (defaults to claude-haiku-4-5-20251001 for anthropic, gpt-4o-mini for openai)
// AI_BASE_URL: custom base URL for openai-compatible providers (e.g. http://localhost:11434/v1 for Ollama)
// AI_API_KEY: generic API key (falls back to ANTHROPIC_API_KEY or OPENAI_API_KEY)

const AI_PROVIDER = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();
const AI_MODEL = process.env.AI_MODEL
  ?? (AI_PROVIDER === "anthropic" ? "claude-haiku-4-5-20251001" : "gpt-4o-mini");
const AI_API_KEY = process.env.AI_API_KEY
  ?? (AI_PROVIDER === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY)
  ?? "";

export const anthropic = new Anthropic({
  apiKey: AI_PROVIDER === "anthropic" ? AI_API_KEY : (process.env.ANTHROPIC_API_KEY ?? "unused"),
});

const openai = new OpenAI({
  apiKey: AI_API_KEY || "unused",
  ...(process.env.AI_BASE_URL ? { baseURL: process.env.AI_BASE_URL } : {}),
});

/**
 * Unified LLM call — routes to Anthropic or OpenAI-compatible provider.
 * Returns the text content of the first message.
 */
async function callLLM(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
}): Promise<string> {
  if (AI_PROVIDER === "openai") {
    const res = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: opts.maxTokens,
      messages: [
        { role: "system", content: opts.system },
        ...opts.messages,
      ],
    });
    return res.choices[0]?.message?.content ?? "";
  }

  // Default: Anthropic
  const res = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: opts.messages,
  });
  return res.content[0].type === "text" ? res.content[0].text : "";
}

export interface EcosystemInsights {
  daily_brief: string;
  ecosystem_health: "thriving" | "growing" | "stable" | "stagnant";
  top_chain: { name: string; metric: string; reason: string };
  anomalies: { chain: string; finding: string; severity: "low" | "medium" | "high" }[];
  bridge_summary: string;
  key_insights: { title: string; body: string; icon: string }[];
  generated_at: string;
}

// ─── Mock mode ────────────────────────────────────────────────────────────────
// Set AI_MOCK=true in .env.local to skip all Claude API calls during dev.
// Production builds or AI_MOCK=false will call the real API.
const IS_MOCK = process.env.AI_MOCK === "true";

const MOCK_INSIGHTS: EcosystemInsights = {
  daily_brief:
    "The Initia ecosystem is running normally across its interconnected rollup network. Multiple minitias are processing transactions and producing blocks at consistent rates. Cross-rollup IBC channels remain active.",
  ecosystem_health: "growing",
  top_chain: {
    name: "Initia L1",
    metric: "Interwoven-1 mainnet",
    reason: "The L1 anchor chain maintains consistent block production and validator participation.",
  },
  anomalies: [],
  bridge_summary:
    "Interwoven Bridge channels are operational. Token transfer channels between L1 and minitias are active.",
  key_insights: [
    {
      title: "Network Active",
      body: "Multiple minitias are live and producing blocks. Cross-rollup IBC channels remain open.",
      icon: "⚡",
    },
    {
      title: "Bridge Infrastructure",
      body: "OPinit bridges provide the settlement layer connecting minitias to Initia L1.",
      icon: "🔗",
    },
    {
      title: "AI Mock Mode",
      body: "Set AI_MOCK=false in .env.local to enable live Claude-powered analysis.",
      icon: "🤖",
    },
  ],
  generated_at: new Date().toISOString(),
};

function mockChatReply(data?: EcosystemOverview, message?: string): string {
  if (!data) return "No ecosystem data available. Try again in a moment.";
  const live = data.minitias.filter(m => (m.metrics?.blockHeight ?? 0) > 0 && !m.isMainnetRef);
  const byTx = [...live].sort((a, b) => (b.metrics?.totalTxCount ?? 0) - (a.metrics?.totalTxCount ?? 0));
  const byScore = [...live].sort((a, b) => (b.pulseScore?.total ?? 0) - (a.pulseScore?.total ?? 0));
  const byBlockTime = [...live].sort((a, b) => (a.metrics?.avgBlockTime ?? 99) - (b.metrics?.avgBlockTime ?? 99));
  const network = data.l1.chainId.includes("interwoven") ? "mainnet" : "testnet";
  const q = (message ?? "").toLowerCase();

  // ── Action intents (MUST be before generic topic matchers) ──

  const sendMatch = q.match(/(?:send|transfer|envoie|envoyer)\s+([\d.]+)\s*(?:init)?\s*(?:to|à|vers)\s*(init1[a-z0-9]+)/);
  if (sendMatch) {
    const addr = sendMatch[2];
    if (/^init1[a-z0-9]{38}$/.test(addr)) {
      return `Preparing to send **${sendMatch[1]} INIT** to \`${addr}\`. `
        + `Review the action card below and click **Execute** to sign with auto-sign. `
        + `The transaction will be broadcast on Initia L1 (${network}).`;
    }
    return `The address \`${addr}\` doesn't look valid — Initia addresses are \`init1\` followed by 38 alphanumeric characters.\n\n`
      + `Please double-check and try again.`;
  }

  const stakeMatch = q.match(/(?:stake|delegate|staker|déléguer)\s+([\d.]+)\s*(?:init)?\s*(?:on|with|to|sur|avec|à)\s+(.+)/i);
  if (stakeMatch) {
    const valName = stakeMatch[2].trim().replace(/[.!?]+$/, "");
    const val = data.l1.validators?.find(v => v.moniker.toLowerCase().includes(valName.toLowerCase()));
    return `Preparing to delegate **${stakeMatch[1]} INIT** to **${val?.moniker ?? valName}**. `
      + (val ? `Commission: ${(parseFloat(val.commission_rate || "0") * 100).toFixed(1)}%. ` : "")
      + `Review the action card below and click **Execute** to sign. `
      + `There are **${data.l1.totalValidators} validators** active on ${network}.`;
  }

  const bridgeAmountMatch = q.match(/(?:bridge|pont|transférer)\s+([\d.]+)\s*(?:init)?/);
  if (bridgeAmountMatch) {
    return `Preparing to bridge **${bridgeAmountMatch[1]} INIT** from L1 via the Interwoven Bridge. `
      + `Review the action card below and click **Open Bridge** to select a destination chain.`;
  }

  // ── Wallet / personal fund queries ──

  const isWalletQuery = /\b(my|mes|mon|ma|nos|notre|j'ai|a.t.on)\b.*\b(fund|fond|stak|delega|balanc|solde|token|init)\b/i.test(q)
    || /\b(where|où|combien).*(stak|fond|fund|init|balanc|solde)/i.test(q)
    || /\b(balance|solde|wallet|portefeuille)\b/i.test(q)
    || /\b(ai.je|j'ai|a.t.on)\b.*\b(fond|fund|init|token|stak)/i.test(q);
  if (isWalletQuery) {
    // The chat route injects [USER WALLET DATA] into the message when available.
    // If wallet data is present in the message, the AI (or this mock) should use it.
    if (q.includes("[user wallet data")) {
      const walletSection = (message ?? "").match(/\[USER WALLET DATA[^\]]*\]([\s\S]*?)$/i);
      if (walletSection) return `Here's what I found for your wallet:\n\n${walletSection[1].trim()}`;
    }
    return `To check your staking positions, connect your wallet first. Once connected, I can query your delegations on Initia L1 and show you exactly where your INIT is staked.`;
  }

  // ── Generic topic questions ──

  // Deploy questions
  if (q.includes("deploy") || q.includes("build") || q.includes("launch") || q.includes("where should")) {
    const top3 = byScore.slice(0, 3);
    return `For deploying on Initia ${network}, here are the top chains by Pulse Score:\n\n`
      + top3.map((m, i) => `**${i + 1}. ${m.prettyName}** — Pulse Score ${m.pulseScore?.total ?? "N/A"}/100, ${(m.metrics?.totalTxCount ?? 0).toLocaleString()} txs, ${m.metrics?.avgBlockTime?.toFixed(1) ?? "?"}s blocks`).join("\n")
      + `\n\n${top3[0]?.prettyName} leads with the best combination of activity, decentralization, and IBC connectivity. For DeFi apps specifically, fast block time matters most — ${byBlockTime[0]?.prettyName} has the fastest at ${byBlockTime[0]?.metrics?.avgBlockTime?.toFixed(1)}s.`;
  }

  // Staking questions (generic — no amount/validator specified)
  if (q.includes("stak") || q.includes("validator") || q.includes("delegate")) {
    const vals = data.l1.validators?.slice(0, 3) ?? [];
    return `There are **${data.l1.totalValidators} validators** on Initia ${network}. `
      + `For a balanced staking strategy, consider splitting across mid-tier validators to support decentralization.\n\n`
      + (vals.length > 0 ? `Top validators by voting power: ${vals.map(v => `**${v.moniker}** (${(parseFloat(v.commission_rate || "0") * 100).toFixed(0)}% commission)`).join(", ")}.` : "")
      + `\n\nAvoid concentrating on the top 1-2 validators — the network is healthier when stake is distributed.`
      + `\n\nYou can stake directly from here — try: "stake 10 INIT on Chorus One"`;
  }

  // Bridge questions (generic)
  if (q.includes("bridge") || (q.includes("transfer") && !sendMatch) || q.includes("move") || q.includes("send")) {
    return `You can bridge INIT tokens directly from this page using the Interwoven Bridge. `
      + `The Pulse rollup (initia-pulse-1) is connected to Initia L1 via OPinit bridge.\n\n`
      + `There are currently **${data.totalIbcChannels} IBC channels** active across the ${network}. `
      + `Try: "bridge 5 INIT" to get started.`;
  }

  // Health / status questions
  if (q.includes("health") || q.includes("status") || q.includes("how is") || q.includes("report")) {
    const top = byTx.slice(0, 3);
    const chainList = top.map(m => `**${m.prettyName}** (${(m.metrics?.totalTxCount ?? 0).toLocaleString()} txs)`).join(", ");
    return `**Ecosystem Status — ${network.toUpperCase()}**\n\n`
      + `${live.length} active rollups, ${data.totalIbcChannels} IBC channels, ${data.l1.totalValidators} validators. `
      + `L1 at block ${data.l1.blockHeight.toLocaleString()} with ${data.l1.totalTxCount.toLocaleString()} total txs.\n\n`
      + `Most active: ${chainList}. All chains producing blocks normally.`;
  }

  // Default — still give useful info
  const top = byTx.slice(0, 3);
  const chainList = top.map(m => `**${m.prettyName}** (${(m.metrics?.totalTxCount ?? 0).toLocaleString()} txs, score ${m.pulseScore?.total ?? "?"})`).join(", ");
  return `The Initia ${network} has **${live.length} active rollups** and **${data.totalIbcChannels} IBC channels**. `
    + `L1 is at block **${data.l1.blockHeight.toLocaleString()}** with **${data.l1.totalValidators} validators**.\n\n`
    + `Top chains: ${chainList}.\n\n`
    + `Ask me about deploying, staking, bridging, or ecosystem health for specific recommendations.`;
}

function buildEcosystemContext(data: EcosystemOverview): string {
  // Exclude mainnet reference chains from AI analysis — they're visual-only
  const testnetChains = data.minitias.filter((m) => !m.isMainnetRef);
  const liveChains = testnetChains.filter(
    (m) => m.metrics?.blockHeight && m.metrics.blockHeight > 0
  );
  const totalTxs = testnetChains.reduce((s, m) => s + (m.metrics?.totalTxCount || 0), 0);
  const transferChannels = data.ibcChannels.filter((c) => c.portId === "transfer");

  const chainDetails = liveChains
    .sort((a, b) => (b.metrics?.blockHeight || 0) - (a.metrics?.blockHeight || 0))
    .map((m) => {
      const parts = [`${m.prettyName} (${m.chainId})`];
      if (m.metrics?.blockHeight) parts.push(`blocks: ${formatNumber(m.metrics.blockHeight)}`);
      if (m.metrics?.totalTxCount) parts.push(`txs: ${formatNumber(m.metrics.totalTxCount)}`);
      if (m.metrics?.activeValidators) parts.push(`validators: ${m.metrics.activeValidators}`);
      if (m.metrics?.latestBlockTime) {
        const age = Math.floor((Date.now() - new Date(m.metrics.latestBlockTime).getTime()) / 1000);
        parts.push(`last block: ${age}s ago`);
      }
      return `- ${parts.join(", ")}`;
    })
    .join("\n");

  const unreachable = testnetChains
    .filter((m) => !m.metrics?.blockHeight || m.metrics.blockHeight === 0)
    .map((m) => m.prettyName)
    .join(", ");

  return `
INITIA ECOSYSTEM SNAPSHOT — ${new Date(data.lastUpdated).toUTCString()}

OVERVIEW:
- Total minitias registered: ${testnetChains.length}
- Live / reachable: ${liveChains.length}
- Unreachable: ${unreachable || "none"}
- IBC channels: ${data.totalIbcChannels} total (${transferChannels.length} token transfer)
- Total transactions across ecosystem: ${totalTxs > 0 ? formatNumber(totalTxs) : "data unavailable"}

LIVE CHAINS (sorted by block height):
${chainDetails || "No live chain data available"}

L1 VALIDATORS (${data.l1.totalValidators} active on ${data.l1.chainId}):
${(data.l1.validators ?? []).slice(0, 20).map(v => `- ${v.moniker} (${v.operator_address}) — commission: ${(parseFloat(v.commission_rate || "0") * 100).toFixed(1)}%`).join("\n") || "No validator data"}
Note: These are INITIA validators, not generic Cosmos validators. They validate the Initia L1.

INTERWOVEN BRIDGE:
- ${transferChannels.length} active token transfer channels between L1 and minitias
- ${data.ibcChannels.filter((c) => c.portId === "nft-transfer").length} NFT transfer channels

MAINNET REFERENCE (read-only — these chains are on mainnet, not testnet):
${data.minitias.filter((m) => m.isMainnetRef).map((m) => `- ${m.prettyName} (${m.chainId}) — mainnet, no live metrics available from testnet`).join("\n") || "none"}
Note: Mainnet chains are listed for reference only. We can discuss deployment strategies for mainnet but cannot show live testnet metrics for them.
`.trim();
}

const SYSTEM_PROMPT = `You are the AI analyst for Initia Pulse, a real-time intelligence platform for the Initia blockchain ecosystem.
Initia is a Layer 1 blockchain with interconnected rollups called "minitias" linked via the Interwoven Bridge (native IBC).
Your role is to analyze real-time chain data and generate sharp, data-driven insights for crypto developers and DeFi power users.

Tone: precise, technical, concise. Like a Bloomberg analyst, not a chatbot.
Never be vague. Reference specific chain names, numbers, and patterns.
If data is limited, say so clearly and work with what's available.

IMPORTANT: The live metrics you see are from the Initia TESTNET (initiation-2). Mainnet chains (Blackwing, Civitia, Echelon, etc.) are listed for reference — you can discuss them, their use cases, and deployment strategies, but be transparent that live metrics are testnet-only. When users ask about mainnet deployment, provide useful context about what's available there.`;

export async function generateInsights(data: EcosystemOverview, forceReal = false): Promise<EcosystemInsights> {
  if (IS_MOCK && !forceReal) return { ...MOCK_INSIGHTS, generated_at: new Date().toISOString() };

  const fallback: EcosystemInsights = {
    daily_brief: "Ecosystem data collected. Analysis temporarily unavailable.",
    ecosystem_health: "stable",
    top_chain: { name: "—", metric: "—", reason: "Insufficient data" },
    anomalies: [],
    bridge_summary: "Bridge channel data available. Volume metrics pending.",
    key_insights: [],
    generated_at: new Date().toISOString(),
  };

  try {
    const context = buildEcosystemContext(data);

    const rawText = await callLLM({
      system: SYSTEM_PROMPT,
      maxTokens: 900,
      messages: [
        {
          role: "user",
          content: `Analyze this ecosystem snapshot and return a JSON object with this exact structure:
{
  "daily_brief": "2-3 sentence narrative summary of the current ecosystem state",
  "ecosystem_health": "thriving|growing|stable|stagnant",
  "top_chain": { "name": "chain name", "metric": "e.g. 30.2M blocks", "reason": "one sentence" },
  "anomalies": [{ "chain": "name", "finding": "specific observation", "severity": "low|medium|high" }],
  "bridge_summary": "one sentence about Interwoven Bridge activity",
  "key_insights": [
    { "title": "short title", "body": "1-2 sentences", "icon": "emoji" }
  ]
}

Return ONLY valid JSON, no markdown, no explanation.

DATA:
${context}`,
        },
      ],
    });

    const raw = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    try {
      const parsed = JSON.parse(raw);
      return { ...parsed, generated_at: new Date().toISOString() };
    } catch {
      return fallback;
    }
  } catch (err) {
    console.error("[generateInsights] API call failed, using fallback:", err instanceof Error ? err.message : err);
    return fallback;
  }
}

// ─── PulseAdvisor ─────────────────────────────────────────────────────────────

const ADVISOR_SYSTEM = `You are PulseAdvisor, an Initia ecosystem intelligence layer embedded in Initia Pulse.
You have real-time data about every minitia, validator, and bridge on the Interwoven Network.
Your job: give sharp, data-driven recommendations. Cite specific numbers. Be opinionated.
Tone: like a senior Initia developer advising a colleague, not a generic assistant.
Return ONLY valid JSON matching the exact schema requested. No markdown, no explanation outside the JSON.`;

// ── Oracle context helper ─────────────────────────────────────────────────────
function buildOracleContext(
  history?: { ecosystemHealth: string; brief: string; blockHeight: number; activeMinitilas: number }[]
): string {
  if (!history?.length) return "";
  return `\nPULSEORACLE SNAPSHOTS (on-chain, initia-pulse-1 — last ${Math.min(history.length, 3)}):\n${
    history.slice(0, 3).map(s =>
      `  [${s.ecosystemHealth.toUpperCase()}] L1 Block: ${s.blockHeight.toLocaleString()}, Live minitias: ${s.activeMinitilas} — "${s.brief.slice(0, 120)}"`
    ).join("\n")
  }\n`;
}

// ── Deploy Advisor ────────────────────────────────────────────────────────────
export async function generateDeployAdvice(
  minitias: MinitiaWithMetrics[],
  bridges: OpinitBridge[],
  ibcChannels: IbcChannel[],
  requirements: { appType: string; needs: string[] },
  oracleHistory?: { ecosystemHealth: string; brief: string; blockHeight: number; activeMinitilas: number }[]
): Promise<DeployAdvice> {
  // Exclude our own rollup and mainnet visual-only refs from recommendations
  const live = minitias.filter(m => (m.metrics?.blockHeight ?? 0) > 0 && !m.isOurs && !m.isMainnetRef && m.chainId !== "initia-pulse-1");

  const chainSummaries = live.map(m => {
    const bridge = bridges.find(b => b.bridge_id === m.bridgeId);
    const channels = ibcChannels.filter(c => (c.sourceChainId === m.chainId || c.destChainId === m.chainId) && c.portId === "transfer");
    const parts: string[] = [
      `${m.prettyName} (${m.chainId})`,
      m.metrics?.avgBlockTime ? `block_time: ${m.metrics.avgBlockTime.toFixed(2)}s` : "",
      m.metrics?.totalTxCount ? `total_txs: ${formatNumber(m.metrics.totalTxCount)}` : "",
      m.metrics?.activeValidators ? `validators: ${m.metrics.activeValidators}` : "",
      `ibc_channels: ${channels.length}`,
      bridge ? `fraud_window: ${bridge.config.finalization_period}` : "no_bridge_data",
      bridge ? `oracle_enabled: ${bridge.config.oracle_enabled}` : "",
      bridge ? `da: ${bridge.batch_info?.chain_type ?? "INITIA"}` : "",
      m.isOurs ? "our_rollup: true" : "",
    ].filter(Boolean);
    return `- ${parts.join(", ")}`;
  }).join("\n");

  // Pre-compute needs matrix — helps Claude match requirements to chains
  const needsMatrix = requirements.needs.length > 0 ? [
    "",
    "NEEDS MATRIX (pre-computed from live data):",
    ...requirements.needs.map(need => {
      let matches: string[] = [];
      if (need === "oracle")   matches = live.filter(m => bridges.find(b => b.bridge_id === m.bridgeId)?.config.oracle_enabled).map(m => m.prettyName);
      if (need === "ibc")      matches = live.filter(m => ibcChannels.some(c => (c.sourceChainId === m.chainId || c.destChainId === m.chainId) && c.portId === "transfer")).map(m => m.prettyName);
      if (need === "celestia") matches = live.filter(m => bridges.find(b => b.bridge_id === m.bridgeId)?.batch_info?.chain_type === "CELESTIA").map(m => m.prettyName);
      if (need === "fast")     matches = live.filter(m => (m.metrics?.avgBlockTime ?? 99) < 2).map(m => m.prettyName);
      if (need === "evm")      matches = live.filter(m => m.chainId.includes("move") || m.chainId.includes("evm") || m.chainId.includes("black")).map(m => m.prettyName);
      return `  ${need}: ${matches.length > 0 ? matches.join(", ") : "none detected — use best available"}`;
    }),
  ].join("\n") : "";

  const oracleCtx = buildOracleContext(oracleHistory);

  const prompt = `A developer wants to deploy on Initia. Profile:
App type: ${requirements.appType}
Requirements: ${requirements.needs.join(", ") || "none specified"}

Available live minitias (real-time data):
${chainSummaries}
${needsMatrix}
${oracleCtx}
Return JSON:
{
  "top_chain": { "chainId": "...", "prettyName": "...", "score": 0-100, "reason": "1 sentence with specific numbers" },
  "alternatives": [{ "chainId": "...", "prettyName": "...", "score": 0-100, "reason": "1 sentence" }],
  "rationale": "2-3 sentences explaining the recommendation with data",
  "warnings": ["specific concern if any"]
}
Include 2 alternatives. If no live chains match well, say so in warnings.`;

  // Data-driven scoring (used for mock mode AND as fallback when API is unavailable)
  function localDeployAdvice(): DeployAdvice {
    const scored = live.map(m => {
      let score = 40;
      const bridge = bridges.find(b => b.bridge_id === m.bridgeId);
      if (m.pulseScore?.total) score = Math.max(score, m.pulseScore.total);
      if (requirements.needs.includes("oracle") && bridge?.config.oracle_enabled) score += 15;
      if (requirements.needs.includes("ibc") && ibcChannels.some(c => c.sourceChainId === m.chainId || c.destChainId === m.chainId)) score += 12;
      if (requirements.needs.includes("celestia") && bridge?.batch_info?.chain_type === "CELESTIA") score += 15;
      if (requirements.needs.includes("fast") && (m.metrics?.avgBlockTime ?? 99) < 2) score += 15;
      if (requirements.needs.includes("evm") && (m.chainId.includes("evm") || m.chainId.includes("move"))) score += 15;
      if (requirements.needs.includes("low-gas")) score += 5;
      if (requirements.appType === "DeFi / DEX" && (m.metrics?.avgBlockTime ?? 99) < 1.5) score += 10;
      if (requirements.appType === "Gaming / NFT" && (m.metrics?.avgBlockTime ?? 99) < 1) score += 10;
      if (requirements.appType === "Data / Oracle" && ibcChannels.filter(c => c.sourceChainId === m.chainId || c.destChainId === m.chainId).length > 2) score += 10;
      return { m, score: Math.min(score, 98) };
    }).sort((a, b) => b.score - a.score);

    const top = scored[0];
    const alts = scored.slice(1, 3);
    return {
      top_chain: {
        chainId: top?.m.chainId ?? "—",
        prettyName: top?.m.prettyName ?? "—",
        score: top?.score ?? 0,
        reason: `Best match for ${requirements.appType} — ${top?.m.metrics?.totalTxCount ? formatNumber(top.m.metrics.totalTxCount) + " txs processed" : "active chain"}, ${top?.m.metrics?.avgBlockTime ? top.m.metrics.avgBlockTime.toFixed(1) + "s blocks" : "consistent block production"}.`,
      },
      alternatives: alts.map(a => ({
        chainId: a.m.chainId,
        prettyName: a.m.prettyName,
        score: a.score,
        reason: `${a.m.metrics?.activeValidators ? a.m.metrics.activeValidators + " validators" : "Active"}, ${a.m.metrics?.blockHeight ? formatNumber(a.m.metrics.blockHeight) + " blocks" : "live"}.`,
      })),
      rationale: `Ranked ${live.length} live minitias by tx volume, block time, and ${requirements.needs.length > 0 ? requirements.needs.join("/") + " support" : "general fitness"}. ${top?.m.prettyName} leads on the metrics that matter for ${requirements.appType}.`,
      warnings: live.length < 3 ? ["Limited live chains available — consider waiting for more minitias to come online."] : [],
    };
  }

  if (IS_MOCK) return localDeployAdvice();

  try {
    const text = await callLLM({ system: ADVISOR_SYSTEM, maxTokens: 600, messages: [{ role: "user", content: prompt }] });
    const raw = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    try { return JSON.parse(raw) as DeployAdvice; } catch {
      return localDeployAdvice();
    }
  } catch (err) {
    console.error("[generateDeployAdvice] API failed, using local scoring:", err instanceof Error ? err.message : err);
    return localDeployAdvice();
  }
}

// ── Stake Advisor ─────────────────────────────────────────────────────────────
export async function generateStakeAdvice(
  validators: L1Validator[],
  amount: number,
  riskProfile: "conservative" | "balanced" | "aggressive",
  oracleHistory?: { ecosystemHealth: string; brief: string; blockHeight: number; activeMinitilas: number }[]
): Promise<StakeAdvice> {
  const totalPower = validators.reduce((s, v) => s + parseInt(v.voting_power || "0"), 0);

  const valSummaries = validators
    .filter(v => !v.jailed)
    .sort((a, b) => parseInt(b.voting_power) - parseInt(a.voting_power))
    .slice(0, 30)
    .map(v => {
      const vp = parseInt(v.voting_power || "0");
      const vpPct = totalPower > 0 ? ((vp / totalPower) * 100).toFixed(1) : "0";
      const commission = (parseFloat(v.commission_rate || "0") * 100).toFixed(1);
      const missed = v.missed_blocks !== undefined ? ` | missed_blocks: ${v.missed_blocks}` : "";
      return `- ${v.moniker} | vp: ${vpPct}% | commission: ${commission}%${missed}`;
    }).join("\n");

  const oracleCtx = buildOracleContext(oracleHistory);

  const prompt = `A user wants to stake ${amount} INIT. Risk profile: ${riskProfile}.

Active validators (sorted by voting power, top 30):
${valSummaries}
${oracleCtx}
Risk profile guidance:
- conservative: prefer low commission, established validators, avoid top-3 (decentralization)
- balanced: mix of performance and decentralization
- aggressive: optimize for lowest commission, don't mind smaller validators

Return JSON:
{
  "recommendations": [
    { "moniker": "...", "operator_address": "...", "score": 0-100, "rationale": "1-2 sentences with specific %", "risks": ["specific risk"] }
  ],
  "strategy": "1-2 sentences on overall staking strategy for this profile",
  "warnings": ["any specific concern"]
}
Provide exactly 3 recommendations.`;

  function localStakeAdvice(): StakeAdvice {
    const active = validators.filter(v => !v.jailed).sort((a, b) => parseInt(b.voting_power) - parseInt(a.voting_power));
    const totalPwr = active.reduce((s, v) => s + parseInt(v.voting_power || "0"), 0);
    let picks: typeof active;
    let strategy: string;
    if (riskProfile === "conservative") {
      picks = active.slice(3).filter(v => parseFloat(v.commission_rate || "0") < 0.1).slice(0, 3);
      if (picks.length < 3) picks = active.slice(3, 6);
      const top3Power = active.slice(0, 3).reduce((s, v) => s + parseInt(v.voting_power || "0"), 0);
      strategy = `Split ${amount} INIT across ${picks.length} mid-tier validators to maximize decentralization. Avoiding top-3 validators who control ${totalPwr > 0 ? ((top3Power / totalPwr) * 100).toFixed(0) : "?"}% of voting power.`;
    } else if (riskProfile === "aggressive") {
      picks = [...active].sort((a, b) => parseFloat(a.commission_rate || "0") - parseFloat(b.commission_rate || "0")).slice(0, 3);
      strategy = `Stake ${amount} INIT with lowest-commission validators for maximum yield. Accept concentration risk.`;
    } else {
      picks = [active[1], active[Math.floor(active.length / 3)], active[Math.floor(active.length * 2 / 3)]].filter(Boolean);
      strategy = `Distribute ${amount} INIT across large, mid, and small validators for balanced risk/reward.`;
    }
    return {
      recommendations: picks.map((v, i) => {
        const vp = parseInt(v.voting_power || "0");
        const vpPct = totalPwr > 0 ? ((vp / totalPwr) * 100).toFixed(1) : "0";
        const commission = (parseFloat(v.commission_rate || "0") * 100).toFixed(1);
        return {
          moniker: v.moniker,
          operator_address: v.operator_address,
          score: 85 - i * 8,
          rationale: `${vpPct}% voting power, ${commission}% commission. ${riskProfile === "conservative" ? "Outside top-3 for decentralization." : riskProfile === "aggressive" ? "Low commission maximizes yield." : "Good balance of stake size and reliability."}`,
          risks: parseFloat(v.commission_rate || "0") > 0.1 ? ["High commission rate"] : [],
        };
      }),
      strategy,
      warnings: active.length < 10 ? ["Limited validator set — monitor for concentration risks."] : [],
    };
  }

  if (IS_MOCK) return localStakeAdvice();

  try {
    const text = await callLLM({ system: ADVISOR_SYSTEM, maxTokens: 600, messages: [{ role: "user", content: prompt }] });
    const raw = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    try { return JSON.parse(raw) as StakeAdvice; } catch {
      return localStakeAdvice();
    }
  } catch (err) {
    console.error("[generateStakeAdvice] API failed, using local scoring:", err instanceof Error ? err.message : err);
    return localStakeAdvice();
  }
}

// ── Bridge Advisor ────────────────────────────────────────────────────────────
export async function generateBridgeAdvice(
  minitias: MinitiaWithMetrics[],
  bridges: OpinitBridge[],
  ibcChannels: IbcChannel[],
  params: { token: string; fromChain: string; toChain: string },
  oracleHistory?: { ecosystemHealth: string; brief: string; blockHeight: number; activeMinitilas: number }[]
): Promise<BridgeAdvice> {
  const fromMinitia = minitias.find(m => m.chainId === params.fromChain);
  const toMinitia   = minitias.find(m => m.chainId === params.toChain);
  const relevantBridges = bridges.slice(0, 10).map(b => {
    const minitia = minitias.find(m => m.bridgeId === b.bridge_id);
    const isLive = (minitia?.metrics?.blockHeight ?? 0) > 0;
    const parts = [
      `Bridge #${b.bridge_id} (${minitia?.prettyName ?? "unknown"})`,
      `finality: ${b.config.finalization_period}`,
      `submit: ${b.config.submission_interval}`,
      `oracle: ${b.config.oracle_enabled}`,
      `status: ${isLive ? "LIVE" : "offline"}`,
      minitia?.metrics?.blockHeight ? `blocks: ${formatNumber(minitia.metrics.blockHeight)}` : "",
      `da: ${b.batch_info?.chain_type ?? "INITIA"}`,
    ].filter(Boolean);
    return `- ${parts.join(" | ")}`;
  }).join("\n");

  const ibcSummary = ibcChannels
    .filter(c => c.portId === "transfer")
    .slice(0, 15)
    .map(c => `- ${c.sourceChainId} → ${c.destChainId} (${c.channelId})`)
    .join("\n");

  const oracleCtx = buildOracleContext(oracleHistory);

  const prompt = `A user wants to bridge ${params.token} from ${fromMinitia?.prettyName ?? params.fromChain} to ${toMinitia?.prettyName ?? params.toChain}.

OPinit Bridges available:
${relevantBridges}

IBC Transfer Channels:
${ibcSummary}
${oracleCtx}
Initia Bridge mechanics:
- OPinit (Optimistic): deposit on L1 → minitia mints. Withdrawals take finality_period (often 7 days).
- IBC: near-instant (<10s) for token transfers between connected chains.
- For L1→Minitia: OPinit deposit is fast (same direction as fraud proof security).

Return JSON:
{
  "path": ["step1 chain", "step2 chain"],
  "total_time": "human readable estimate",
  "steps": [
    { "action": "what to do", "time": "time estimate", "note": "important detail" }
  ],
  "rationale": "1-2 sentences explaining why this path"
}`;

  function localBridgeAdvice(): BridgeAdvice {
    const directIbc = ibcChannels.find(c =>
      c.portId === "transfer" &&
      ((c.sourceChainId === params.fromChain && c.destChainId === params.toChain) ||
       (c.sourceChainId === params.toChain && c.destChainId === params.fromChain))
    );
    const toBridge = bridges.find(b => {
      const m = minitias.find(mi => mi.bridgeId === b.bridge_id);
      return m?.chainId === params.toChain || m?.chainId === params.fromChain;
    });
    const finality = toBridge?.config.finalization_period ?? "7 days";

    if (directIbc) {
      return {
        path: [params.fromChain, params.toChain],
        total_time: "~10 seconds",
        steps: [
          { action: `IBC transfer ${params.token} via ${directIbc.channelId}`, time: "~10s", note: "Direct IBC channel available — fastest route." },
        ],
        rationale: `Direct IBC transfer channel exists between ${fromMinitia?.prettyName ?? params.fromChain} and ${toMinitia?.prettyName ?? params.toChain}. This is the fastest and cheapest route.`,
      };
    }
    const l1Id = params.fromChain.startsWith("init") ? params.fromChain : "initiation-2";
    return {
      path: [params.fromChain, l1Id, params.toChain],
      total_time: `Deposit: ~instant | Withdrawal: ${finality}`,
      steps: [
        { action: `Bridge ${params.token} from ${fromMinitia?.prettyName ?? params.fromChain} to L1`, time: toBridge ? "~instant (deposit direction)" : "~10s via IBC", note: "OPinit deposit or IBC transfer to L1." },
        { action: `Bridge ${params.token} from L1 to ${toMinitia?.prettyName ?? params.toChain}`, time: "~instant (deposit direction)", note: `Withdrawal direction takes ${finality}. Oracle: ${toBridge?.config.oracle_enabled ? "enabled" : "N/A"}.` },
      ],
      rationale: `No direct channel between these chains. Routing via Initia L1 as hub. Deposit direction is near-instant; withdrawals subject to ${finality} finality window.`,
    };
  }

  if (IS_MOCK) return localBridgeAdvice();

  try {
    const text = await callLLM({ system: ADVISOR_SYSTEM, maxTokens: 500, messages: [{ role: "user", content: prompt }] });
    const raw = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    try { return JSON.parse(raw) as BridgeAdvice; } catch {
      return localBridgeAdvice();
    }
  } catch (err) {
    console.error("[generateBridgeAdvice] API failed, using local routing:", err instanceof Error ? err.message : err);
    return localBridgeAdvice();
  }
}

export async function chatWithEcosystem(
  message: string,
  history: { role: "user" | "assistant"; content: string }[],
  data: EcosystemOverview,
  fullMode = false
): Promise<string> {
  if (IS_MOCK) return mockChatReply(data, message);

  const context = buildEcosystemContext(data);

  // Add Pulse Scores to context if available
  const scoreContext = data.minitias
    .filter(m => m.pulseScore && (m.metrics?.blockHeight ?? 0) > 0)
    .sort((a, b) => (b.pulseScore?.total ?? 0) - (a.pulseScore?.total ?? 0))
    .map(m => `- ${m.prettyName}: ${m.pulseScore!.total}/100 (activity:${m.pulseScore!.activity} decentralization:${m.pulseScore!.decentralization} bridge:${m.pulseScore!.bridge} growth:${m.pulseScore!.growth} uptime:${m.pulseScore!.uptime})`)
    .join("\n");

  const fullContext = scoreContext
    ? `${context}\n\nPULSE SCORES (0-100 health rating per chain):\n${scoreContext}`
    : context;

  const chatMessages: { role: "user" | "assistant"; content: string }[] = [
    ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    {
      role: "user" as const,
      content: `${message}\n\n[CURRENT ECOSYSTEM DATA]\n${fullContext}`,
    },
  ];

  const widgetRules = `
CRITICAL FORMATTING RULES:
- Answer in 2-4 SHORT sentences MAX. Never exceed 4 sentences.
- NEVER use markdown headers (##), bullet points, bold (**), or code blocks.
- Use plain conversational text only.
- ANSWER THE ACTUAL QUESTION — don't default to a generic ecosystem report. Be specific and actionable.`;

  const fullRules = `
FORMATTING RULES:
- Be thorough but concise. Use 3-8 sentences.
- You may use simple line breaks to separate ideas, but avoid heavy markdown.
- Reference Pulse Scores (0-100) when comparing chains — they are computed from live data.
- If the user asks about a specific chain, mention its Pulse Score breakdown (activity, decentralization, bridge, growth, uptime).
- When mentioning bridging, tell the user they can bridge directly from this page.
- Users can execute on-chain actions via natural language. If they say "send 10 INIT to init1...", "stake 50 INIT on Maestro", or "bridge 5 INIT", the app will show an executable action card with auto-signing. Confirm the action details in your response when you detect these intents.

RESPONSE BEHAVIOR:
- ANSWER THE USER'S ACTUAL QUESTION. If they ask "where to deploy", recommend specific chains with reasons — don't just give a generic ecosystem report.
- If they ask for deployment advice, rank the top 2-3 chains by Pulse Score and explain why each is suitable.
- If they ask about staking, recommend specific validators with commission rates.
- If they ask about bridging, give the specific route and mention the bridge button.
- Always be actionable and specific, not just descriptive.`;

  try {
    return await callLLM({
      system: SYSTEM_PROMPT + `
You are Pulse AI, the chat assistant for Initia Pulse.
${fullMode ? fullRules : widgetRules}
- If asked what the app does: "Initia Pulse monitors 13+ rollups in real-time, writes AI analysis on-chain via PulseOracle, and helps you deploy, stake, or bridge with live intelligence."
- Ground every answer in the live ecosystem data provided. Be specific with numbers.`,
      maxTokens: fullMode ? 500 : 250,
      messages: chatMessages,
    }) || "Unable to process query.";
  } catch (err) {
    console.error("[chatWithEcosystem] API failed, using mock reply:", err instanceof Error ? err.message : err);
    return mockChatReply(data, message);
  }
}
