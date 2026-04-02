import { MinitiaWithMetrics, IbcChannel } from "./types";

// ─── Pulse Score: 0–100 health rating per minitia ──────────────────────────
//
// Formula:
//   Activity          (25%) — tx volume relative to ecosystem max
//   Decentralization  (20%) — validator count + voting power distribution
//   Connectivity      (20%) — OPinit bridge + IBC channel count
//   Growth            (15%) — recent block tx activity
//   Uptime            (15%) — block freshness + avg block time
//   Liquidity          (5%) — token supply presence
//
// Each sub-score is 0–100, then weighted and summed.

interface ScoreBreakdown {
  activity: number;
  decentralization: number;
  bridge: number;
  growth: number;
  uptime: number;
  total: number;
}

export function computePulseScore(
  minitia: MinitiaWithMetrics,
  allMinitias: MinitiaWithMetrics[],
  ibcChannels?: IbcChannel[],
): ScoreBreakdown {
  const m = minitia.metrics;
  if (!m || m.blockHeight === 0) {
    return { activity: 0, decentralization: 0, bridge: 0, growth: 0, uptime: 0, total: 0 };
  }

  // ── Activity (25%) — tx count relative to max, log-scaled
  const maxTx = Math.max(...allMinitias.map(x => x.metrics?.totalTxCount ?? 0), 1);
  const txRatio = m.totalTxCount / maxTx;
  const activity = m.totalTxCount === 0 ? 0
    : Math.min(100, Math.round(30 + 70 * Math.log10(1 + txRatio * 9) / Math.log10(10)));

  // ── Decentralization (20%) — validator count + voting power concentration
  const vals = m.activeValidators ?? 0;
  let decentralization = vals === 0 ? 20
    : vals === 1 ? 50
    : vals <= 3 ? 70
    : vals <= 10 ? 85
    : 100;
  // Bonus/penalty: if L1 validators have concentrated voting power, penalize
  // (not applicable per-rollup since rollups typically have 1 sequencer)
  if (vals > 1) {
    decentralization = Math.min(100, decentralization + 5); // multi-validator = healthier
  }

  // ── Connectivity (20%) — OPinit bridge + IBC channels
  const hasBridge = minitia.bridgeId !== undefined && minitia.bridgeId > 0;
  const chainIbcCount = ibcChannels
    ? ibcChannels.filter(ch =>
        ch.portId === "transfer" &&
        (ch.sourceChainId === minitia.chainId || ch.destChainId === minitia.chainId)
      ).length
    : 0;
  const gasRatio = (m.lastBlockGasWanted ?? 0) > 0
    ? (m.lastBlockGasUsed ?? 0) / m.lastBlockGasWanted!
    : 0;
  // Bridge: 0-40 from bridge presence, 0-30 from IBC channels, 0-30 from gas utilization
  const bridgeBase = hasBridge ? 40 : 10;
  const ibcScore = Math.min(30, chainIbcCount * 10); // 1 channel=10, 2=20, 3+=30
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
    : 100; // multiple denoms = richer ecosystem

  const total = Math.min(100, Math.round(
    activity * 0.25 +
    decentralization * 0.20 +
    bridge * 0.20 +
    growth * 0.15 +
    uptime * 0.15 +
    liquidity * 0.05
  ));

  return { activity, decentralization, bridge, growth, uptime, total };
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
  if (score >= 75) return "#00FF88"; // green — healthy
  if (score >= 50) return "#00D4FF"; // cyan — decent
  if (score >= 25) return "#FFB800"; // amber — weak
  return "#FF3366";                  // red — critical
}

export function scoreLabel(score: number): string {
  if (score >= 75) return "HEALTHY";
  if (score >= 50) return "ACTIVE";
  if (score >= 25) return "WEAK";
  return "CRITICAL";
}
