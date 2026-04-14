import type { EcosystemOverview } from "./types";

// ─── L1 health ──────────────────────────────────────────────────────────────
//
// Initia L1 and OPinit minitias are genuinely different animals, so they need
// different health checks. For a minitia what matters is anchoring to L1
// (Settlement axis). For L1 itself the questions are:
//   1. Is it producing blocks?
//   2. Is the validator set large enough that slashing/halting risk is low?
//
// We intentionally keep the L1 formula dead simple and transparent: one or
// two boolean checks with explicit point deductions. No hidden weighting.

export interface L1Health {
  score: number;
  color: string;
  label: string;
  blockAgeSec: number;
  validators: number;
  activeProposals: number;
  issues: string[];
}

const MIN_HEALTHY_VALIDATORS = 5;

export function computeL1Health(l1: EcosystemOverview["l1"]): L1Health {
  const latest = l1.recentBlocks?.[0];
  const blockAgeSec = latest
    ? Math.max(0, (Date.now() - new Date(latest.timestamp).getTime()) / 1000)
    : Infinity;

  const issues: string[] = [];
  let score = 100;

  if (l1.totalValidators === 0) {
    score = 0;
    issues.push("no validators reported");
  } else if (l1.totalValidators < MIN_HEALTHY_VALIDATORS) {
    score -= 30;
    issues.push(`only ${l1.totalValidators} validators`);
  }

  if (!Number.isFinite(blockAgeSec)) {
    score -= 40;
    issues.push("no recent block data");
  } else if (blockAgeSec > 300) {
    score -= 40;
    issues.push(`last block ${Math.round(blockAgeSec)}s ago`);
  } else if (blockAgeSec > 60) {
    score -= 10;
  }

  score = Math.max(0, Math.min(100, score));
  const color = score >= 75 ? "#00FF88"
              : score >= 50 ? "#00D4FF"
              : score >= 25 ? "#FFB800"
              : "#FF3366";
  const label = score >= 75 ? "HEALTHY"
              : score >= 50 ? "ACTIVE"
              : score >= 25 ? "WEAK"
              : "CRITICAL";

  return {
    score,
    color,
    label,
    blockAgeSec: Number.isFinite(blockAgeSec) ? blockAgeSec : -1,
    validators: l1.totalValidators,
    activeProposals: l1.activeProposals,
    issues,
  };
}
