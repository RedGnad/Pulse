import type { MinitiaWithMetrics, EcosystemOverview } from "./types";
import type { L1Health } from "./l1-health";

// ─── Action routing ─────────────────────────────────────────────────────────
//
// Pulse's action picker is organised around WHAT a user can actually do on
// an Initia rollup vs on L1, not around what a wallet exposes.
//
//   Bridge / Send    — applicable to any chain (rollup or L1)
//   Trade            — needs a DeFi or NFT-marketplace rollup
//   Play             — needs a Gaming rollup
//   Mint             — needs an NFT rollup
//   Stake / Vote     — L1 only (minitias are OPinit rollups with a single
//                      operator and no gov module)
//
// Category tags come from the authoritative initia-registry profile.json,
// not from a hand-maintained list in our code.

export type Action = "bridge" | "trade" | "play" | "mint" | "send" | "stake" | "vote";

// The category labels used by initia-registry (case-sensitive in practice).
const CATEGORY_DEFI = "DeFi";
const CATEGORY_GAMING = "Gaming";
const CATEGORY_NFT = "NFT";

// Actions compatible with each category tag.
const CATEGORY_ACTIONS: Record<string, Action[]> = {
  [CATEGORY_DEFI]:   ["bridge", "send", "trade"],
  [CATEGORY_GAMING]: ["bridge", "send", "play"],
  [CATEGORY_NFT]:    ["bridge", "send", "mint", "trade"],
};

// Actions that only make sense on Initia L1.
export const L1_ONLY_ACTIONS: ReadonlySet<Action> = new Set(["stake", "vote"]);

// Actions that apply to any live rollup regardless of category.
const CATEGORY_AGNOSTIC: ReadonlySet<Action> = new Set(["bridge", "send"]);

/**
 * True if the given rollup (via its registry profile) supports the action.
 * - bridge / send always match (any chain).
 * - stake / vote never match a rollup (L1 only).
 * - trade / play / mint match only when the rollup's category allows them.
 *
 * A rollup with no profile falls back to "bridge + send only" — honest
 * default, we don't invent capabilities we haven't verified.
 */
export function rollupSupportsAction(m: MinitiaWithMetrics, action: Action): boolean {
  if (L1_ONLY_ACTIONS.has(action)) return false;
  if (CATEGORY_AGNOSTIC.has(action)) return true;
  const cat = m.profile?.category;
  if (!cat) return false;
  const allowed = CATEGORY_ACTIONS[cat];
  return allowed ? allowed.includes(action) : false;
}

/**
 * Compact human description of WHAT the action does on a specific rollup.
 * Uses the vip.actions from the registry when available, otherwise a
 * generic fallback.
 */
export function actionHintForRollup(m: MinitiaWithMetrics, action: Action): string | null {
  if (!m.profile?.vipActions?.length) return null;
  // Very light heuristic — look for a vip action whose title mentions the verb.
  const verb = action.toLowerCase();
  const match = m.profile.vipActions.find(a =>
    a.title.toLowerCase().includes(verb) || a.description.toLowerCase().includes(verb)
  );
  return match?.description ?? m.profile.summary ?? m.profile.description ?? null;
}

// ─── Target abstraction ─────────────────────────────────────────────────────

export type Target =
  | {
      kind: "l1";
      chainId: string;
      name: string;
      score: number;
      color: string;
      label: string;
      category: "L1";
      description: string;
      health: L1Health;
    }
  | {
      kind: "rollup";
      chainId: string;
      name: string;
      score: number;
      color: string;
      label: string;
      category: string | null;
      description: string | null;
      minitia: MinitiaWithMetrics;
    };

export interface ScoredRollup {
  minitia: MinitiaWithMetrics;
  score: number;
  color: string;
  label: string;
}

/**
 * Build the ordered list of targets for an action.
 *
 * - L1 always appears (it's valid for everything).
 * - For rollup-compatible actions, add every live rollup whose profile
 *   category allows the action, sorted by pulse score.
 * - For L1-only actions (stake, vote), only L1 is returned.
 *
 * `scoredRollups` is passed in rather than computed here to keep this module
 * free of pulse-score imports (avoids circular deps with the test setup).
 */
export function buildTargets(
  action: Action | null,
  eco: EcosystemOverview,
  l1Health: L1Health,
  scoredRollups: ScoredRollup[],
): Target[] {
  const out: Target[] = [];

  out.push({
    kind: "l1",
    chainId: eco.l1.chainId,
    name: "Initia L1",
    score: l1Health.score,
    color: l1Health.color,
    label: l1Health.label,
    category: "L1",
    description: "Settlement layer. Staking, governance, and OPinit bridge anchoring.",
    health: l1Health,
  });

  if (!action || L1_ONLY_ACTIONS.has(action)) return out;

  for (const sr of scoredRollups) {
    if (!rollupSupportsAction(sr.minitia, action)) continue;
    out.push({
      kind: "rollup",
      chainId: sr.minitia.chainId,
      name: sr.minitia.prettyName ?? sr.minitia.name,
      score: sr.score,
      color: sr.color,
      label: sr.label,
      category: sr.minitia.profile?.category ?? null,
      description: sr.minitia.profile?.summary ?? sr.minitia.profile?.description ?? null,
      minitia: sr.minitia,
    });
  }

  return out;
}
