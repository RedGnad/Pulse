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

  // ── Activity (30%) — tx count relative to max in ecosystem
  const maxTx = Math.max(...allMinitias.map(x => x.metrics?.totalTxCount ?? 0), 1);
  const txRatio = m.totalTxCount / maxTx;
  const activity = Math.min(100, Math.round(txRatio * 100));

  // ── Decentralization (20%) — validator count (1=bad, 5+=good, 20+=excellent)
  const vals = m.activeValidators ?? 0;
  const decentralization = vals === 0 ? 10 // at least running
    : vals === 1 ? 20
    : vals <= 3 ? 40
    : vals <= 10 ? 60
    : vals <= 20 ? 80
    : 100;

  // ── Bridge (20%) — has bridge + gas utilization as proxy for bridge activity
  const hasBridge = minitia.bridgeId !== undefined && minitia.bridgeId > 0;
  const gasRatio = (m.lastBlockGasWanted ?? 0) > 0
    ? (m.lastBlockGasUsed ?? 0) / m.lastBlockGasWanted!
    : 0;
  const bridge = hasBridge
    ? Math.min(100, 50 + Math.round(gasRatio * 50))
    : Math.round(gasRatio * 30); // no bridge = capped lower

  // ── Growth (15%) — recent block tx count relative to average
  const avgTxPerBlock = m.blockHeight > 0 ? m.totalTxCount / m.blockHeight : 0;
  const recentTx = m.lastBlockTxCount ?? 0;
  const growthRatio = avgTxPerBlock > 0 ? recentTx / avgTxPerBlock : (recentTx > 0 ? 1 : 0);
  const growth = growthRatio >= 2 ? 100    // 2x+ average = booming
    : growthRatio >= 1 ? 70                // above average
    : growthRatio >= 0.5 ? 50              // holding
    : growthRatio > 0 ? 30                 // declining
    : 15;                                  // no recent tx but chain alive

  // ── Uptime (15%) — block time freshness
  const blockAge = m.latestBlockTime
    ? (Date.now() - new Date(m.latestBlockTime).getTime()) / 1000
    : Infinity;
  const avgBt = m.avgBlockTime ?? 0;
  const uptime = blockAge < 30 ? 100      // block in last 30s
    : blockAge < 120 ? 85                 // last 2 min
    : blockAge < 600 ? 60                 // last 10 min
    : blockAge < 3600 ? 30                // last hour
    : blockAge < 86400 ? 10              // last day
    : 0;                                   // stale
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
