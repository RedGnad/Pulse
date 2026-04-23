# Initia Pulse — Submission Description

**Initia Pulse is the action router for Initia's specialized appchains.**

Describe what you want to do in plain English — *stake 1 INIT on Chorus One*, *bridge 5 INIT to a rollup*, *vote on proposal #42* — and Pulse routes you to the minitia whose on-chain profile actually supports that action, with a full reasoning trail. A live on-chain health signal sits on top as a guardrail, so an unhealthy rollup quietly stops being a recommendation.

Pulse is **not** a bridge router. Initia already routes *assets* between rollups via the Interwoven Bridge. Pulse operates at the layer above: it picks the destination appchain given an intent, and the Interwoven Bridge is one execution path among others.

---

## What makes it composable

A dedicated **MiniEVM rollup (`initia-pulse-1`)** runs an AI agent that continuously monitors **every minitia, validator, IBC channel, and OPinit bridge** across the Initia ecosystem. Every 5 minutes it compresses the analysis into an **immutable on-chain snapshot** via the `PulseOracle` contract, with a `bytes32 keccak256` data-integrity hash.

**Any smart contract on Initia can call `isHealthy(minHealth, minStreak)`** to gate its own operations on ecosystem stability — a lending protocol can pause withdrawals when health drops, a DEX can raise fees when `healthStreak()` breaks, a bridge can enter emergency mode when `isHealthy(1, 1)` is false.

This is **DeFi-composable infrastructure**, not a dashboard.

---

## Smart contracts on Pulse EVM rollup

- **`PulseOracle.sol`** — circular buffer of 50 snapshots, multi-writer roles, `bytes32 dataHash` verification. Exposes `latest()`, `getHistory()`, `isHealthy(minHealth, minStreak)`, `healthStreak(minHealth)`. Deployed at `0xc09F200B0d98ca2b21761aFA191FEdb55a9AA4B4` on `initia-pulse-1`.

- **`PulseGate.sol`** — 30-line reference consumer showing any protocol how to gate operations on Pulse signal: `require(oracle.isHealthy(2, 3), "PulseGate: ecosystem health too low")`. Server-side mirror of this contract is exposed at `/proof` for verification against live snapshots.

- **`PulseGov.sol`** — L1 Cosmos governance voting from an EVM rollup via the `ICosmos` precompile (`0x…00f1`). An EVM wallet calls `vote(proposalId, option)` on the Pulse rollup; the contract relays `cosmos.gov.v1.MsgVote` to Initia L1. Demonstrates the Interwoven architecture end-to-end.

---

## What the frontend delivers

- **`/` — Act (the router).** Intent-first landing. Type a query, see the winning minitia with pass/fail reasoning facts (*profile action: borrow*, *supports USDC*, *supports leverage*), the 6-axis Pulse Score, and a deep-link into the execution layer. Six categorized suggestion blocks (Ecosystem / Staking / Bridge / Security / Deploy / Data) are one click away.

- **`/proof` — Proof layer.** Supporting evidence for every routing decision, as two tabs: the `PulseOracle` on-chain snapshot explorer and the `PulseGate` reference contract with live verdict.

- **`/oracle` and `/gate`** — standalone deep-links to each proof tab for bookmarking.

---

## Technical highlights

- **Deterministic intent router (`src/lib/action-routing.ts`)** — keyword parser over three vocabularies (verbs, assets, modifiers) with word-boundary regex. For each candidate minitia the scorer walks its `initia-registry` profile (`category`, `description`, `vipActions[]`) and emits typed `ReasoningFact[]` — pass/fail checks the UI renders next to the card. Final ranking: `0.55 × intentScore + 0.45 × liveHealth`. L1-only actions (stake, vote) route to Initia L1 as a first-class destination. Covered by 43 vitest cases + a sanity harness (`scripts/intent-sanity.mts`).

- **6-axis Pulse Score (`src/lib/pulse-score.ts`)** — pure function of observable state, not an LLM opinion: Activity (25%), Settlement / L1 anchoring (20%), Bridge / IBC connectivity (20%), Growth (15%), Uptime (15%), Liquidity (5%).

- **Oracle integrity** — `PulseOracle.sol` circular buffer, multi-writer roles, `keccak256 dataHash` verification. Writes every 5 min via a backend signer.

- **Live data** — Cosmos REST, Rollytics indexer, OPinit bridge configs.

- **Stack** — Next.js 16 (Turbopack), TypeScript, **InterwovenKit v2 (deep integration)**, wagmi, ethers.js, Solidity ^0.8.24.

---

## Initia-native features

- **Interwoven Bridge** — integrated via InterwovenKit's `openBridge` hook. Cross-rollup transfers from L1 to any minitia trigger directly from the router when the intent verb is *bridge*.

- **Natural-language auto-signing actions** — the router supports *send 10 INIT to @alice*, *stake 50 INIT on Chorus One*, *unstake 1 INIT and send to @alice*, *vote yes on proposal #42*. The parsed intent is rendered as a confirmation card; execution goes through InterwovenKit with an auto-sign session on `initiation-2` (whitelisting `MsgSend`, `MsgDelegate`, `MsgUndelegate`). When the session key is authorized, subsequent actions execute headlessly; otherwise each action opens one signature popup.

- **`.init` usernames** — *Send 1 INIT to @alice* resolves via `useUsernameQuery` before execution.

- **L1 governance from an EVM rollup** — `PulseGov.sol` + `ICosmos` precompile. `MsgVote` is triggered from the EVM execution environment, demonstrating Cosmos-native message types invoked from Solidity.

---

## Links

- **Live demo:** https://initiapulse.vercel.app
- **Demo video:** https://drive.google.com/file/d/1LhD_1tWPdtQ_gDvdm2jiHrvJcCxfbRUV/view?usp=sharing
- **Source:** https://github.com/RedGnad/Pulse
