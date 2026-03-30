import { MinitiaWithMetrics } from "./types";

// ─── Pulse Score: 0–100 health rating per minitia ──────────────────────────
//
// Formula:
//   Activity     (30%) — tx volume relative to ecosystem max
//   Decentralization (20%) — validator count
//   Bridge       (20%) — has OPinit bridge + gas utilization
//   Growth       (15%) — recent block tx activity
//   Uptime       (15%) — block freshness + avg block time
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
  allMinitias: MinitiaWithMetrics[]
): ScoreBreakdown {
  const m = minitia.metrics;
  if (!m || m.blockHeight === 0) {
    return { activity: 0, decentralization: 0, bridge: 0, growth: 0, uptime: 0, total: 0 };
  }

  // ── Activity (30%) — tx count relative to max, log-scaled so mid-tier chains aren't crushed
  const maxTx = Math.max(...allMinitias.map(x => x.metrics?.totalTxCount ?? 0), 1);
  const txRatio = m.totalTxCount / maxTx;
  // Log scale: 10% of max → ~65, 50% → ~85, 100% → 100
  const activity = m.totalTxCount === 0 ? 0
    : Math.min(100, Math.round(30 + 70 * Math.log10(1 + txRatio * 9) / Math.log10(10)));

  // ── Decentralization (20%) — validator count, calibrated for rollups (1 is normal, not bad)
  const vals = m.activeValidators ?? 0;
  const decentralization = vals === 0 ? 20 // chain running with sequencer
    : vals === 1 ? 50                      // standard rollup setup
    : vals <= 3 ? 70
    : vals <= 10 ? 85
    : 100;

  // ── Bridge (20%) — has bridge + IBC connectivity
  const hasBridge = minitia.bridgeId !== undefined && minitia.bridgeId > 0;
  const ibcCount = allMinitias.filter(x => x.chainId !== minitia.chainId).length; // rough proxy
  const gasRatio = (m.lastBlockGasWanted ?? 0) > 0
    ? (m.lastBlockGasUsed ?? 0) / m.lastBlockGasWanted!
    : 0;
  const bridge = hasBridge
    ? Math.min(100, 60 + Math.round(gasRatio * 40))
    : 30 + Math.round(gasRatio * 20);

  // ── Growth (15%) — recent block tx count relative to average
  const avgTxPerBlock = m.blockHeight > 0 ? m.totalTxCount / m.blockHeight : 0;
  const recentTx = m.lastBlockTxCount ?? 0;
  const growthRatio = avgTxPerBlock > 0 ? recentTx / avgTxPerBlock : (recentTx > 0 ? 1 : 0);
  const growth = growthRatio >= 2 ? 100
    : growthRatio >= 1 ? 80
    : growthRatio >= 0.5 ? 60
    : growthRatio > 0 ? 45
    : 30;                                  // no recent tx but chain alive

  // ── Uptime (15%) — block time freshness
  const blockAge = m.latestBlockTime
    ? (Date.now() - new Date(m.latestBlockTime).getTime()) / 1000
    : Infinity;
  const avgBt = m.avgBlockTime ?? 0;
  const uptime = blockAge < 30 ? 100
    : blockAge < 120 ? 90
    : blockAge < 600 ? 70
    : blockAge < 3600 ? 40
    : blockAge < 86400 ? 15
    : 0;
  // Bonus for fast block time
  const btBonus = avgBt > 0 && avgBt < 3 ? 10 : avgBt < 5 ? 5 : 0;

  const total = Math.min(100, Math.round(
    activity * 0.30 +
    decentralization * 0.20 +
    bridge * 0.20 +
    growth * 0.15 +
    Math.min(100, uptime + btBonus) * 0.15
  ));

  return { activity, decentralization, bridge, growth, uptime: Math.min(100, uptime + btBonus), total };
}

export function computeAllPulseScores(
  minitias: MinitiaWithMetrics[]
): Map<string, ScoreBreakdown> {
  const scores = new Map<string, ScoreBreakdown>();
  for (const m of minitias) {
    scores.set(m.chainId, computePulseScore(m, minitias));
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
