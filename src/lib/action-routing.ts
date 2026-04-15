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

// Actions where L1 is a *valid* destination alongside rollups. Trade / play /
// mint are rollup-only (L1 has no perps venue, no game, no NFT launchpad).
// Bridge + send are category-agnostic and work on L1 too.
const L1_VALID_ACTIONS: ReadonlySet<Action> = new Set(["bridge", "send", "stake", "vote"]);

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
      reasoning?: TargetReasoning;
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
      reasoning?: TargetReasoning;
    };

// ─── Intent parsing ─────────────────────────────────────────────────────────
//
// Pulse's differentiator isn't "filter rollups by category", it's "route an
// intent to the appchain whose profile actually lists the thing you're trying
// to do". The input is a natural-language phrase ("borrow USDC",
// "liquid stake INIT", "trade ETH perps"); we pull out three signals —
// verbs, assets, modifiers — and match them against the haystack we built
// from the authoritative initia-registry profile (description + summary +
// vip.actions title/description).
//
// Vocabularies are intentionally minimal: only terms that appear verbatim in
// at least one live mainnet profile. No LLM required, no synonym explosion.
// Missing a term here is better than inventing matches that aren't in the
// registry data.

const VERB_VOCAB: Record<string, string[]> = {
  // canonical → list of surface forms we'll accept in user input
  borrow:    ["borrow", "loan"],
  supply:    ["supply", "lend", "lending", "deposit"],
  stake:     ["stake", "staking"],
  liquidstake: ["liquid stake", "liquid staking", "lst"],
  trade:     ["trade", "swap", "exchange"],
  perp:      ["perp", "perps", "perpetual", "perpetuals", "leverage", "leveraged", "long", "short", "futures"],
  mint:      ["mint"],
  vault:     ["vault", "one-click", "auto-compound", "delta neutral", "dn"],
  yield:     ["yield", "farm", "farming", "boost", "boosted"],
  meme:      ["meme", "memecoin", "launchpad"],
  play:      ["play", "game", "gameplay"],
};

const ASSET_VOCAB = [
  "init", "sinit", "xinit", "sxinit", "milkinit", "deinit", "iusd",
  "usdc", "usdt", "eth", "weth", "btc", "wbtc", "sol",
  "vip", "esinit",
];

const MODIFIER_VOCAB = [
  "money market", "lending", "lst", "liquid", "vault", "perp",
  "leverage", "delta neutral", "meme", "launchpad", "marketplace",
];

export interface ParsedIntent {
  raw: string;
  action: Action;
  verbs: string[];      // canonical verb keys from VERB_VOCAB
  assets: string[];     // canonical asset names
  modifiers: string[];  // canonical modifier names
}

// Word-boundary match that handles multi-word phrases like "liquid stake"
// or "delta neutral" without getting fooled by substrings ("liquid" matching
// "liquidity", "init" matching "initia"). Case-insensitive.
function hasWord(hay: string, term: string): boolean {
  // escape any regex special characters in the term, allow whitespace to be
  // any run of whitespace so "liquid stake" matches "liquid  stake" or
  // "liquid\nstake".
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${esc}\\b`, "i").test(hay);
}

/**
 * Parse a free-text intent into structured signals. Keyword-based — no LLM
 * call. Returns whatever it can find; callers should handle empty arrays
 * gracefully (the intent scorer degrades to zero contribution).
 */
export function parseIntent(text: string, action: Action): ParsedIntent {
  const verbs: string[] = [];
  for (const [canonical, forms] of Object.entries(VERB_VOCAB)) {
    if (forms.some(f => hasWord(text, f))) verbs.push(canonical);
  }
  const assets = ASSET_VOCAB.filter(a => hasWord(text, a));
  const modifiers = MODIFIER_VOCAB.filter(m => hasWord(text, m));
  return { raw: text, action, verbs, assets, modifiers };
}

// ─── Intent scoring ─────────────────────────────────────────────────────────

export interface ReasoningFact {
  kind: "pass" | "fail" | "info";
  label: string;
}

export interface TargetReasoning {
  intentMatch: number;   // 0-100, normalized
  liveHealth: number;    // mirrors the pulse score for convenience
  composite: number;     // the number targets are actually sorted by
  facts: ReasoningFact[];
}

function buildHaystack(m: MinitiaWithMetrics): string {
  const p = m.profile;
  if (!p) return "";
  const parts = [
    p.description ?? "",
    p.summary ?? "",
    ...(p.vipActions ?? []).flatMap(a => [a.title, a.description]),
  ];
  return parts.join(" \n ").toLowerCase();
}

/**
 * Score how well a rollup's profile matches a parsed intent. Returns 0-100.
 *
 * The match is keyword-in-haystack — simple on purpose. Verbs are the
 * highest-signal match (the action verb the user said maps to a vipAction
 * title); assets tell us whether the specific token is supported; modifiers
 * break ties between otherwise-similar rollups.
 *
 * An intent with no parsed tokens at all returns 0 — the composite score
 * then falls back to pure live health, which is the honest default.
 */
export function scoreIntentMatch(
  intent: ParsedIntent,
  m: MinitiaWithMetrics,
): { score: number; facts: ReasoningFact[] } {
  const facts: ReasoningFact[] = [];
  const hay = buildHaystack(m);
  if (!hay) {
    return { score: 0, facts: [{ kind: "info", label: "no profile metadata" }] };
  }

  const verbMatches = intent.verbs.filter(v =>
    VERB_VOCAB[v].some(form => hasWord(hay, form)),
  );
  const assetMatches = intent.assets.filter(a => hasWord(hay, a));
  const modMatches = intent.modifiers.filter(m2 => hasWord(hay, m2));

  const totalTokens = intent.verbs.length + intent.assets.length + intent.modifiers.length;
  if (totalTokens === 0) return { score: 0, facts: [] };

  const verbContrib  = intent.verbs.length     ? (verbMatches.length  / intent.verbs.length)     * 50 : 0;
  const assetContrib = intent.assets.length    ? (assetMatches.length / intent.assets.length)    * 30 : 0;
  const modContrib   = intent.modifiers.length ? (modMatches.length   / intent.modifiers.length) * 20 : 0;
  const score = Math.round(verbContrib + assetContrib + modContrib);

  for (const v of verbMatches) {
    facts.push({ kind: "pass", label: `profile action: ${v}` });
  }
  for (const v of intent.verbs) {
    if (!verbMatches.includes(v)) {
      facts.push({ kind: "fail", label: `no ${v} action listed` });
    }
  }
  for (const a of assetMatches) {
    facts.push({ kind: "pass", label: `supports ${a.toUpperCase()}` });
  }
  for (const a of intent.assets) {
    if (!assetMatches.includes(a)) {
      facts.push({ kind: "fail", label: `${a.toUpperCase()} not mentioned` });
    }
  }
  for (const m3 of modMatches) {
    facts.push({ kind: "pass", label: m3 });
  }

  return { score, facts };
}

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
 *   category allows the action.
 * - For L1-only actions (stake, vote), only L1 is returned.
 *
 * Sorting:
 * - When no intent is given, targets are ordered by live health (pulse score).
 * - When an intent IS given, each rollup is also scored against the parsed
 *   intent tokens vs its registry profile (vip.actions, description), and
 *   targets are sorted by a composite = 0.55 * intentMatch + 0.45 * health.
 *   The reasoning object attached to each target captures why it placed where
 *   it did — this is what the UI surfaces as "routed here because X, not Y".
 *
 * `scoredRollups` is passed in rather than computed here to keep this module
 * free of pulse-score imports (avoids circular deps with the test setup).
 */
export function buildTargets(
  action: Action | null,
  eco: EcosystemOverview,
  l1Health: L1Health,
  scoredRollups: ScoredRollup[],
  intent?: ParsedIntent | null,
): Target[] {
  // L1 only appears when the action is something you can actually do on L1.
  // For trade / play / mint, L1 is not a destination — don't mislead users by
  // showing it as a top-ranked card.
  const l1IsValid = !action || L1_VALID_ACTIONS.has(action);

  const l1Target: Extract<Target, { kind: "l1" }> | null = l1IsValid ? {
    kind: "l1",
    chainId: eco.l1.chainId,
    name: "Initia L1",
    score: l1Health.score,
    color: l1Health.color,
    label: l1Health.label,
    category: "L1",
    description: "Settlement layer. Staking, governance, and OPinit bridge anchoring.",
    health: l1Health,
  } : null;

  // For stake / vote, L1 is the *only* legit target — no rollup competes.
  if (!action || L1_ONLY_ACTIONS.has(action)) {
    return l1Target ? [l1Target] : [];
  }

  const rollupTargets: (Extract<Target, { kind: "rollup" }>)[] = [];

  for (const sr of scoredRollups) {
    if (!rollupSupportsAction(sr.minitia, action)) continue;

    let reasoning: TargetReasoning | undefined;
    let composite = sr.score;

    if (intent && (intent.verbs.length || intent.assets.length || intent.modifiers.length)) {
      const { score: intentMatch, facts } = scoreIntentMatch(intent, sr.minitia);
      composite = Math.round(0.55 * intentMatch + 0.45 * sr.score);
      const cat = sr.minitia.profile?.category;
      const leadFacts: ReasoningFact[] = [];
      if (cat) leadFacts.push({ kind: "pass", label: `${cat} rollup` });
      leadFacts.push({ kind: "info", label: `pulse ${sr.score}` });
      reasoning = {
        intentMatch,
        liveHealth: sr.score,
        composite,
        facts: [...leadFacts, ...facts],
      };
    }

    rollupTargets.push({
      kind: "rollup",
      chainId: sr.minitia.chainId,
      name: sr.minitia.prettyName ?? sr.minitia.name,
      score: sr.score,
      color: sr.color,
      label: sr.label,
      category: sr.minitia.profile?.category ?? null,
      description: sr.minitia.profile?.summary ?? sr.minitia.profile?.description ?? null,
      minitia: sr.minitia,
      reasoning,
    });
  }

  // Merge L1 into the same sort as rollups for bridge / send. L1 has no intent
  // score (the intent vocab is rollup-specific: verbs like "borrow", assets
  // like "USDC", modifiers like "perp" — none of those describe L1 as a
  // destination), so its composite is just its raw health. If a rollup matches
  // the intent well, it legitimately ranks above L1; if the user's intent is
  // vague, the list collapses to pure health and L1 takes its honest place.
  const all: Target[] = l1Target ? [l1Target, ...rollupTargets] : rollupTargets;

  all.sort((a, b) => {
    const av = a.kind === "rollup" ? (a.reasoning?.composite ?? a.score) : a.score;
    const bv = b.kind === "rollup" ? (b.reasoning?.composite ?? b.score) : b.score;
    return bv - av;
  });

  return all;
}
