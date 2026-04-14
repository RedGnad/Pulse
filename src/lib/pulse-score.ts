import { MinitiaWithMetrics, IbcChannel } from "./types";

// ─── Pulse Score: 0–100 health rating per minitia ──────────────────────────
//
// Formula:
//   Activity     (25%) — tx volume relative to ecosystem max
//   Settlement   (20%) — OPinit bridge to L1 + IBC path to Initia L1
//   Connectivity (20%) — OPinit bridge presence + IBC channel count + gas util
//   Growth       (15%) — recent block tx activity
//   Uptime       (15%) — block freshness + avg block time
//   Liquidity     (5%) — token supply presence
//
// NOTE on the Settlement axis: minitias are OPinit optimistic rollups. By
// design they run a single operator without economic stake, so traditional
// "validator count" does not apply. What actually matters for a rollup is
// whether it is anchored to Initia L1 — the OPHost bridge and an IBC path
// back to L1 are the two observable proofs of that anchoring.

interface ScoreBreakdown {
  activity: number;
  settlement: number;
  bridge: number;
  growth: number;
  uptime: number;
  total: number;
}

// Initia L1 chain ids across networks. Settlement is measured against these.
const INITIA_L1_CHAIN_IDS = new Set<string>(["initiation-2", "interwoven-1"]);

export function computePulseScore(
  minitia: MinitiaWithMetrics,
  allMinitias: MinitiaWithMetrics[],
  ibcChannels?: IbcChannel[],
): ScoreBreakdown {
  const m = minitia.metrics;
  if (!m || m.blockHeight === 0) {
    return { activity: 0, settlement: 0, bridge: 0, growth: 0, uptime: 0, total: 0 };
  }

  // ── Activity (25%) — tx count relative to max, log-scaled
  const maxTx = Math.max(...allMinitias.map(x => x.metrics?.totalTxCount ?? 0), 1);
  const txRatio = m.totalTxCount / maxTx;
  const activity = m.totalTxCount === 0 ? 0
    : Math.min(100, Math.round(30 + 70 * Math.log10(1 + txRatio * 9) / Math.log10(10)));

  // ── Settlement (20%) — anchoring to Initia L1
  //   OPinit bridge registered on L1      → +60  (settlement path exists)
  //   IBC transfer channel to Initia L1   → +30  (asset path back to L1)
  //   Both present                        → +10  (fully anchored bonus)
  // Floor at 20 so a chain with neither still scores above zero — we have
  // no evidence it is unsafe, only no evidence it is anchored.
  const hasBridge = minitia.bridgeId !== undefined && minitia.bridgeId > 0;
  const ibcToL1 = ibcChannels
    ? ibcChannels.some(ch =>
        ch.portId === "transfer" && (
          (ch.sourceChainId === minitia.chainId && INITIA_L1_CHAIN_IDS.has(ch.destChainId)) ||
          (ch.destChainId === minitia.chainId && INITIA_L1_CHAIN_IDS.has(ch.sourceChainId))
        )
      )
    : false;
  let settlement = 20;
  if (hasBridge) settlement += 60;
  if (ibcToL1)  settlement += 30;
  if (hasBridge && ibcToL1) settlement = Math.min(100, settlement + 10);
  settlement = Math.min(100, settlement);

  // ── Connectivity (20%) — OPinit bridge + IBC channels + gas utilization
  const chainIbcCount = ibcChannels
    ? ibcChannels.filter(ch =>
        ch.portId === "transfer" &&
        (ch.sourceChainId === minitia.chainId || ch.destChainId === minitia.chainId)
      ).length
    : 0;
  const gasRatio = (m.lastBlockGasWanted ?? 0) > 0
    ? (m.lastBlockGasUsed ?? 0) / m.lastBlockGasWanted!
    : 0;
  const bridgeBase = hasBridge ? 40 : 10;
  const ibcScore = Math.min(30, chainIbcCount * 10);
  const gasScore = Math.round(gasRatio * 30);
  const bridge = Math.min(100, bridgeBase + ibcScore + gasScore);

  // ── Growth (15%) — recent block tx count relative to average
  const avgTxPerBlock = m.blockHeight > 0 ? m.totalTxCount / m.blockHeight : 0;
  const recentTx = m.lastBlockTxCount ?? 0;
  const growthRatio = avgTxPerBlock > 0 ? recentTx / avgTxPerBlock : (recentTx > 0 ? 1 : 0);
  const growth = growthRatio >= 2 ? 100
    : growthRatio >= 1 ? 80
    : growthRatio >= 0.5 ? 60
    : growthRatio > 0 ? 45
    : 30;

  // ── Uptime (15%) — block time freshness
  const blockAge = m.latestBlockTime
    ? (Date.now() - new Date(m.latestBlockTime).getTime()) / 1000
    : Infinity;
  const avgBt = m.avgBlockTime ?? 0;
  const uptimeBase = blockAge < 30 ? 100
    : blockAge < 120 ? 90
    : blockAge < 600 ? 70
    : blockAge < 3600 ? 40
    : blockAge < 86400 ? 15
    : 0;
  const btBonus = avgBt > 0 && avgBt < 3 ? 10 : avgBt < 5 ? 5 : 0;
  const uptime = Math.min(100, uptimeBase + btBonus);

  // ── Liquidity (5%) — token supply presence
  const hasSupply = (m.totalSupply?.length ?? 0) > 0;
  const supplyCount = m.totalSupply?.length ?? 0;
  const liquidity = !hasSupply ? 20
    : supplyCount === 1 ? 50
    : supplyCount <= 3 ? 70
    : 100;

  const total = Math.min(100, Math.round(
    activity * 0.25 +
    settlement * 0.20 +
    bridge * 0.20 +
    growth * 0.15 +
    uptime * 0.15 +
    liquidity * 0.05
  ));

  return { activity, settlement, bridge, growth, uptime, total };
}

export function computeAllPulseScores(
  minitias: MinitiaWithMetrics[],
  ibcChannels?: IbcChannel[],
): Map<string, ScoreBreakdown> {
  const scores = new Map<string, ScoreBreakdown>();
  for (const m of minitias) {
    scores.set(m.chainId, computePulseScore(m, minitias, ibcChannels));
  }
  return scores;
}

export function scoreColor(score: number): string {
  if (score >= 75) return "#00FF88";
  if (score >= 50) return "#00D4FF";
  if (score >= 25) return "#FFB800";
  return "#FF3366";
}

export function scoreLabel(score: number): string {
  if (score >= 75) return "HEALTHY";
  if (score >= 50) return "ACTIVE";
  if (score >= 25) return "WEAK";
  return "CRITICAL";
}
