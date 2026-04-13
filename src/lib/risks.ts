/**
 * Current risks — the heart of Pulse's repositioning.
 *
 * "Is the whole network healthy?" is a useless question because Initia is
 * almost always healthy at the aggregate. The useful question is:
 * "which specific rollup, route, or component is degraded *right now*?"
 *
 * This module derives a flat list of concrete risks from ecosystem data.
 * Each risk is actionable: it names a component, a severity, and a
 * recommendation that the UI can surface as "don't do X on Y right now".
 */

import { MinitiaWithMetrics, IbcChannel, EcosystemOverview } from "./types";
import { computePulseScore } from "./pulse-score";

export type RiskSeverity = "critical" | "elevated" | "watch";
export type RiskKind =
  | "rollup_score"
  | "rollup_stale"
  | "rollup_validators"
  | "rollup_no_bridge"
  | "ibc_channel"
  | "ecosystem_sparse";

export interface Risk {
  id: string;
  kind: RiskKind;
  severity: RiskSeverity;
  target: string;         // human-readable target ("Minimove", "channel-42", etc.)
  targetChainId?: string; // for linking into /act
  headline: string;       // one-line summary, < 80 chars
  detail: string;         // 1-2 sentence explanation
  score?: number;         // 0-100, if a pulse score is attached
  recommendation: string; // "don't bridge", "reduce stake", etc.
  affectedActions: Array<"bridge" | "stake" | "send" | "vote">;
}

const SEVERITY_RANK: Record<RiskSeverity, number> = {
  critical: 3,
  elevated: 2,
  watch: 1,
};

/**
 * Derive all current risks from the ecosystem snapshot.
 * Returns them sorted by severity, highest first.
 * The caller typically slices the top 3-5 for the hero surface.
 */
export function deriveRisks(eco: EcosystemOverview): Risk[] {
  const risks: Risk[] = [];
  const minitias = eco.minitias.filter(m => !m.isMainnetRef);

  for (const m of minitias) {
    risks.push(...deriveRollupRisks(m, minitias, eco.ibcChannels));
  }

  risks.push(...deriveIbcRisks(eco.ibcChannels, minitias));

  const coalesced = coalesceCorrelated(risks);

  // Sort by severity then by ascending score (lowest = worst)
  coalesced.sort((a, b) => {
    const s = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (s !== 0) return s;
    return (a.score ?? 100) - (b.score ?? 100);
  });

  return coalesced;
}

/**
 * When ≥3 rollups share the same risk kind at the same time, it's almost
 * always a correlated failure (indexer glitch, network-wide slow REST,
 * registry drift) rather than independent incidents. Collapse them into a
 * single aggregate risk so the UI doesn't look broken.
 */
function coalesceCorrelated(risks: Risk[]): Risk[] {
  const byKind = new Map<RiskKind, Risk[]>();
  for (const r of risks) {
    const arr = byKind.get(r.kind) ?? [];
    arr.push(r);
    byKind.set(r.kind, arr);
  }

  const out: Risk[] = [];
  for (const [kind, group] of byKind) {
    if (group.length >= 3 && kind !== "rollup_score") {
      const targets = group.map(g => g.target).join(", ");
      const worst = group.reduce((a, b) => SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a);
      const affected = Array.from(new Set(group.flatMap(g => g.affectedActions)));
      out.push({
        id: `coalesced-${kind}`,
        kind,
        severity: worst.severity === "critical" ? "elevated" : worst.severity, // downgrade: correlated ≠ catastrophic
        target: `${group.length} rollups`,
        headline: labelForCoalescedKind(kind, group.length),
        detail: `Affected: ${targets}. This is most likely a correlated data-layer issue (indexer lag, REST node cache) rather than ${group.length} independent failures.`,
        recommendation: "Treat as an advisory. Verify with a direct RPC before blocking any action.",
        affectedActions: affected as Risk["affectedActions"],
      });
    } else {
      out.push(...group);
    }
  }
  return out;
}

function labelForCoalescedKind(kind: RiskKind, n: number): string {
  switch (kind) {
    case "rollup_stale":     return `${n} rollups reporting stale REST state`;
    case "rollup_validators":return `${n} rollups running single-sequencer setups`;
    case "rollup_no_bridge": return `${n} rollups without OPinit bridges`;
    case "ibc_channel":      return `${n} rollups with no transfer channels`;
    default:                 return `${n} rollups affected`;
  }
}

function deriveRollupRisks(
  m: MinitiaWithMetrics,
  all: MinitiaWithMetrics[],
  ibcChannels: IbcChannel[],
): Risk[] {
  const out: Risk[] = [];
  const metrics = m.metrics;

  // No metrics at all — rollup unreachable
  if (!metrics || metrics.blockHeight === 0) {
    out.push({
      id: `rollup-offline-${m.chainId}`,
      kind: "rollup_stale",
      severity: "critical",
      target: m.prettyName ?? m.name,
      targetChainId: m.chainId,
      headline: `${m.prettyName ?? m.name} is unreachable`,
      detail: "No block data returned from the rollup RPC. The chain may be offline, upgrading, or misconfigured in the registry.",
      recommendation: "Do not bridge, stake, or submit transactions on this rollup until blocks resume.",
      affectedActions: ["bridge", "stake", "send", "vote"],
    });
    return out;
  }

  const breakdown = computePulseScore(m, all, ibcChannels);
  const total = breakdown.total;

  // Low aggregate pulse score
  if (total < 40) {
    out.push({
      id: `rollup-score-${m.chainId}`,
      kind: "rollup_score",
      severity: total < 25 ? "critical" : "elevated",
      target: m.prettyName ?? m.name,
      targetChainId: m.chainId,
      headline: `${m.prettyName ?? m.name} pulse score ${total}/100`,
      detail: `Weakest factors: ${weakestFactors(breakdown).join(", ")}. Aggregate health is below the safe-action threshold.`,
      score: total,
      recommendation: "Avoid large bridges or stakes until the score recovers above 50.",
      affectedActions: ["bridge", "stake"],
    });
  } else if (total < 60) {
    out.push({
      id: `rollup-watch-${m.chainId}`,
      kind: "rollup_score",
      severity: "watch",
      target: m.prettyName ?? m.name,
      targetChainId: m.chainId,
      headline: `${m.prettyName ?? m.name} pulse score ${total}/100`,
      detail: `Operating but with soft spots (${weakestFactors(breakdown).join(", ")}). Small actions OK, size down larger ones.`,
      score: total,
      recommendation: "Proceed with caution on sizeable actions.",
      affectedActions: ["bridge", "stake"],
    });
  }

  // Stale blocks — only trust if we can sanity-check the signal.
  // A single REST node lagging is not the same as a halted chain: if the
  // indexer reports a fresh avgBlockTime and the rollup has a real height,
  // the chain is clearly producing and we downgrade (or skip) the signal.
  if (metrics.latestBlockTime) {
    const parsed = new Date(metrics.latestBlockTime).getTime();
    const ageSec = Number.isFinite(parsed) ? (Date.now() - parsed) / 1000 : NaN;
    const chainClearlyLive =
      metrics.blockHeight > 0 &&
      typeof metrics.avgBlockTime === "number" &&
      metrics.avgBlockTime > 0 &&
      metrics.avgBlockTime < 30;

    // Clock-safe: ignore negative / NaN / absurd ages (> 30 days)
    const plausible = Number.isFinite(ageSec) && ageSec > -60 && ageSec < 86400 * 30;

    if (plausible && ageSec > 300) {
      // If indexer says the chain produces ~every avgBlockTime seconds,
      // the REST /blocks/latest lag is almost certainly node-side, not chain-side.
      // Cap severity at "watch" in that case — it's worth showing but it's not
      // a demo-killing critical.
      const severity: RiskSeverity = chainClearlyLive
        ? "watch"
        : ageSec > 1800
        ? "critical"
        : "elevated";

      out.push({
        id: `rollup-stale-${m.chainId}`,
        kind: "rollup_stale",
        severity,
        target: m.prettyName ?? m.name,
        targetChainId: m.chainId,
        headline: chainClearlyLive
          ? `${m.prettyName ?? m.name} REST node lag (${formatAge(ageSec)})`
          : `${m.prettyName ?? m.name} last block ${formatAge(ageSec)} ago`,
        detail: chainClearlyLive
          ? `The chain is still producing blocks (avg ${metrics.avgBlockTime?.toFixed(1)}s) but its public REST endpoint is lagging. Reads may be stale; writes are likely fine.`
          : `The chain has not produced a block for ${formatAge(ageSec)}. Bridges out may time out, stakes won't earn, votes can't be broadcast.`,
        recommendation: chainClearlyLive
          ? "Prefer a backup RPC when querying state; transactions should still broadcast."
          : "Wait for block production to resume before submitting any transaction.",
        affectedActions: chainClearlyLive ? ["bridge"] : ["bridge", "stake", "send", "vote"],
      });
    }
  }

  // Low validator count
  const vals = metrics.activeValidators ?? 0;
  if (vals === 1) {
    out.push({
      id: `rollup-vals-${m.chainId}`,
      kind: "rollup_validators",
      severity: "watch",
      target: m.prettyName ?? m.name,
      targetChainId: m.chainId,
      headline: `${m.prettyName ?? m.name} has a single sequencer`,
      detail: "A single-sequencer rollup has no consensus redundancy. This is normal for early-stage minitias but it concentrates liveness risk.",
      recommendation: "Acceptable for small-size actions; size down for anything significant.",
      affectedActions: ["stake"],
    });
  }

  // No OPinit bridge
  if (!m.bridgeId && !m.isOurs) {
    out.push({
      id: `rollup-bridge-${m.chainId}`,
      kind: "rollup_no_bridge",
      severity: "watch",
      target: m.prettyName ?? m.name,
      targetChainId: m.chainId,
      headline: `${m.prettyName ?? m.name} has no OPinit bridge registered`,
      detail: "Without an OPinit bridge, there is no canonical fast-path between this rollup and Initia L1. Assets can only move via IBC or not at all.",
      recommendation: "Expect slower withdrawals and confirm IBC routes before bridging.",
      affectedActions: ["bridge"],
    });
  }

  return out;
}

function deriveIbcRisks(channels: IbcChannel[], minitias: MinitiaWithMetrics[]): Risk[] {
  const out: Risk[] = [];
  const chainIds = new Set(minitias.map(m => m.chainId));

  // Group transfer channels by endpoint
  const transferByChain = new Map<string, number>();
  for (const ch of channels) {
    if (ch.portId !== "transfer") continue;
    transferByChain.set(ch.sourceChainId, (transferByChain.get(ch.sourceChainId) ?? 0) + 1);
    transferByChain.set(ch.destChainId, (transferByChain.get(ch.destChainId) ?? 0) + 1);
  }

  // A live rollup with zero transfer channels can't receive IBC
  for (const m of minitias) {
    if (!m.metrics || m.metrics.blockHeight === 0) continue;
    const count = transferByChain.get(m.chainId) ?? 0;
    if (count === 0) {
      out.push({
        id: `ibc-isolated-${m.chainId}`,
        kind: "ibc_channel",
        severity: "elevated",
        target: m.prettyName ?? m.name,
        targetChainId: m.chainId,
        headline: `${m.prettyName ?? m.name} has no open transfer channels`,
        detail: "No IBC transfer channels are registered for this rollup. Cross-chain moves are not routable.",
        recommendation: "Use the OPinit bridge instead, or wait for IBC channels to be opened.",
        affectedActions: ["bridge"],
      });
    }
  }

  return out;
}

function weakestFactors(b: { activity: number; decentralization: number; bridge: number; growth: number; uptime: number }): string[] {
  const pairs: [string, number][] = [
    ["activity", b.activity],
    ["decentralization", b.decentralization],
    ["connectivity", b.bridge],
    ["growth", b.growth],
    ["uptime", b.uptime],
  ];
  pairs.sort((a, b) => a[1] - b[1]);
  return pairs.slice(0, 2).map(p => `${p[0]} ${p[1]}`);
}

function formatAge(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h`;
  return `${Math.round(sec / 86400)} d`;
}

/**
 * Risk filter keyed by action. When a user is about to stake/bridge/etc
 * we only care about risks that affect that specific action class.
 */
export function risksForAction(all: Risk[], action: "bridge" | "stake" | "send" | "vote", targetChainId?: string): Risk[] {
  return all.filter(r => {
    if (!r.affectedActions.includes(action)) return false;
    if (targetChainId && r.targetChainId && r.targetChainId !== targetChainId) return false;
    return true;
  });
}
