# Initia Pulse

**An action router for Initia's specialized appchains.** Tell Pulse what you want to do in plain English — *borrow USDC*, *trade ETH perps with leverage*, *mint NFTs* — and it routes you to the minitia whose on-chain profile actually supports the action, with a full reasoning trail. Live risk signals sit on top as a guardrail, so an unhealthy rollup quietly stops being a recommendation.

## Initia Hackathon Submission

- **Project Name**: Initia Pulse

### Project Overview

Initia hosts a growing set of specialized appchains (minitias) — one for perps, one for lending, one for NFTs, one for liquid staking. The user-facing question is no longer *"what is Initia?"*, it's **"which minitia should I use for this specific action, and is it safe right now?"**. Pulse is the routing layer that answers that question.

Pulse reads the authoritative `initia-registry` profiles (category, description, `vipActions`) for every live mainnet minitia, scores each candidate against a parsed user intent, blends that with a live-health score, and routes the user to the best match with a full reasoning trail.

**Pulse is not a bridge router.** Initia already routes *assets* between rollups via the Interwoven Bridge. Pulse operates at the layer above: given an *intent* like "borrow USDC" or "mint NFTs", it picks the destination appchain that actually supports that intent, and the Interwoven Bridge is one execution path among others.

The app is organized around the flow **intent → decision → proof → execution**:

- **`/` — Act (the router)**. Intent-first landing. Type a query, see the winning minitia with pass/fail reasoning facts (`profile action: borrow`, `supports USDC`, `supports leverage`), the Pulse Score axes, and a deep-link into the execution layer. Six canonical demo queries are one click away.
- **`/proof` — Proof layer**. Supporting evidence for the decision the router just made, as two tabs: the `PulseOracle` on-chain snapshot and the `PulseGate` reference contract.
- **Execution (auto-sign)**. Verdict cards deep-link into InterwovenKit's auto-signing flow on L1 (`initiation-2`) for `bridge`, `send`, `stake`, and `vote`. The natural-language action layer lives inline on `/` (the `/ask` route redirects back to it).
- **Deep-links**: `/oracle` and `/gate` mirror the tabs in `/proof` as standalone pages for bookmarking.

### Implementation Detail

- **Intent scorer (`src/lib/action-routing.ts`)**. Deterministic keyword parser over three vocabularies (verbs, assets, modifiers) with word-boundary regex matching. For each candidate minitia, the scorer walks its registry profile (`category`, `description`, `vipActions[]`) and emits typed `ReasoningFact[]` — `pass`/`fail` checks the UI renders next to the card. The final ranking is a composite `0.55 * intentScore + 0.45 * liveHealth`, so a richly matching minitia that is running stale blocks can still be downranked or blocked. L1-only actions (stake, vote) short-circuit to Initia L1 as a first-class destination. See `scripts/intent-sanity.mts` for the verification harness.

- **Deterministic Pulse Score (`src/lib/pulse-score.ts`)**. Per-minitia score on six axes: Activity (25%), Settlement / L1 anchoring (20%), Bridge / IBC connectivity (20%), Growth (15%), Uptime (15%), Liquidity (5%). Pure function of observable state, not an LLM opinion. Covered by vitest.

- **Supporting contracts** (all viewable from `/proof`). `PulseOracle.sol` is a composable Solidity contract on a MiniEVM rollup (`initia-pulse-1`) that publishes a circular history of ecosystem snapshots and exposes `latest()`, `healthStreak()`, and `isHealthy(minHealth, minStreak)` — free-to-read for any contract. `PulseGate.sol` is a 30-line reference consumer showing how a DeFi protocol can gate its own operations on the same signal (`require(oracle.isHealthy(2, 3), ...)`). `PulseGov.sol` uses the `ICosmos` precompile to let an EVM wallet on the Pulse rollup cast Initia L1 governance votes via `execute_cosmos(MsgVote)` — demonstrating the Interwoven architecture end-to-end. Full source in `contracts/`.

- **Initia-native integrations** (all exposed via the `/ask` execution layer):
  - **Interwoven Bridge** via InterwovenKit's `openBridge` hook, reachable from five entry points across the app.
  - **Auto-signing transactions** — natural-language *"send 10 INIT to @alice"*, *"stake 50 INIT on [validator]"*, *"bridge 5 INIT"* — parsed, confirmed, executed via `submitTxBlock` with gas estimated via `estimateGas` + `calculateFee`.
  - **`.init` usernames** resolved via `useUsernameQuery` before tx execution.
  - **L1 governance from an EVM rollup** via `PulseGov.sol` + the `ICosmos` precompile — the Cosmos-native `MsgVote` is triggered from the EVM execution environment.

### How to Run Locally

1. **Install dependencies and start the rollup:**
   ```bash
   npm install
   brew install initia-labs/tap/weave
   weave rollup start -d && weave opinit start executor -d && weave relayer start -d
   ```

2. **Configure environment:** Copy `.env.example` to `.env.local` and set your AI key and `PULSE_ORACLE_PRIVATE_KEY`.

3. **Start the app:**
   ```bash
   npm run dev
   ```

4. **Open `http://localhost:3000`** — connect your wallet via InterwovenKit, type an intent (or click a `try:` chip), and follow the route.

5. **Tests:**
   ```bash
   npm run test                                      # vitest (Pulse Score + risks)
   node --experimental-strip-types scripts/intent-sanity.mts   # intent scorer sanity check
   ```

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Next.js Frontend (InterwovenKit + wagmi)                │
│  /  (Act — router)  ·  /proof  ·  /ask                   │
└────────────────┬─────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────┐
│  Routing layer                                           │
│  parseIntent() → scoreIntentMatch() → buildTargets()     │
│  composite = 0.55 * intent  +  0.45 * liveHealth         │
│  reads: initia-registry profiles, live RPC, IBC graph    │
└────────────────┬─────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────┐
│  AI Engine (Anthropic / OpenAI / any OpenAI-compat API)  │
│  Ask Pulse · brief generation · action card parsing      │
└────────────────┬─────────────────────────────────────────┘
                 │ ethers.js
┌────────────────▼─────────────────────────────────────────┐
│  PulseOracle.sol  (MiniEVM rollup: initia-pulse-1)       │
│  writeSnapshot · isHealthy · healthStreak                │
│  latest · getSnapshot · getHistory[50]                   │
│  + PulseGate.sol (reference consumer, 30 lines)          │
│  + PulseGov.sol  (EVM → Cosmos L1 gov via ICosmos)       │
└──────────────────────────────────────────────────────────┘
```

## Deployed Contracts (local MiniEVM rollup `initia-pulse-1`)

The rollup `initia-pulse-1` runs locally via Weave CLI (`http://127.0.0.1:8545`, chain-id `2150269405855764`) and is not registered on the public Initia explorer — see [Local Dev Limitation](#local-dev-limitation) below.

| Contract | Address | Role |
|---|---|---|
| `PulseOracle` | `0xc09F200B0d98ca2b21761aFA191FEdb55a9AA4B4` | Writes ecosystem snapshots, exposes `isHealthy()` / `healthStreak()` / `latest()` |
| `PulseGate`   | *(deploy via `./scripts/deploy-gate.sh`)* | Reference consumer — gates `gatedDeposit()` on `oracle.isHealthy(2, 3)` |
| `PulseGov`    | *(reference source only)* | EVM → L1 governance votes via the `ICosmos` precompile (`0x…00f1`) |

**Redeploy from scratch:** `./scripts/deploy-oracle.sh` then `./scripts/deploy-gate.sh` (both require `DEPLOYER_PRIVATE_KEY` + a running rollup).

## Trust Model

### What Pulse proves
- **Routing determinism**: The intent scorer and Pulse Score are pure functions of observable state. Given the same registry snapshot and the same live metrics, the winner is reproducible.
- **Data integrity**: `dataHash` (keccak256 commitment) ensures oracle snapshot data hasn't been modified after on-chain commit.
- **Temporal ordering**: Snapshots are timestamped and sequenced in a circular buffer.

### What Pulse does not prove
- **Data provenance**: `dataHash` proves data wasn't modified after commit, it does not cryptographically prove which source produced it. All sources are public Initia APIs, independently verifiable.
- **AI brief correctness**: The brief generated in Ask Pulse is analysis, not financial advice. Always DYOR before acting on a recommendation.

### Current trust assumptions
- Single backend signer writes snapshots (writer key).
- Data sources: `initia-registry`, L1 RPC, minitia RPCs (all public endpoints).
- Multi-writer architecture is implemented in the contract (`setWriter`) for multi-oracle scenarios.

### Decentralization path
- v2: Multiple independent writers with quorum (2-of-3 agreement required).
- v3: On-chain data verification via L1 light client proofs.

---

## Composability: PulseGate

`PulseGate.sol` is the minimal reference for *"read the same signal the router just used, and gate your own operations on it"*:

```solidity
// Only allow deposits when ecosystem is healthy
require(oracle.isHealthy(2, 3), "PulseGate: ecosystem health too low");

// Emergency mode detection
bool emergency = !oracle.isHealthy(1, 1);
```

See `contracts/PulseGate.sol` for the full implementation. The tab at `/proof` renders the contract source + the current oracle reading side by side.

---

## AI Configuration

Pulse supports **any LLM provider** — Anthropic, OpenAI, or any OpenAI-compatible API (Ollama, LM Studio, Groq, Together, etc.).

| Variable | Description | Default |
|---|---|---|
| `AI_PROVIDER` | `anthropic` or `openai` (for any OpenAI-compatible API) | `anthropic` |
| `AI_MODEL` | Model ID to use | `claude-haiku-4-5-20251001` (anthropic) / `gpt-4o-mini` (openai) |
| `AI_API_KEY` | API key (falls back to `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`) | — |
| `AI_BASE_URL` | Custom base URL for local/self-hosted models | — |
| `AI_MOCK` | Set to `true` to skip AI calls entirely (dev mode) | `false` |

**Examples:**

```bash
# Anthropic (default)
AI_API_KEY=sk-ant-...

# OpenAI
AI_PROVIDER=openai
AI_API_KEY=sk-...

# Ollama (local)
AI_PROVIDER=openai
AI_MODEL=llama3
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama

# LM Studio (local)
AI_PROVIDER=openai
AI_MODEL=local-model
AI_BASE_URL=http://localhost:1234/v1
AI_API_KEY=lm-studio
```

## Tech Stack

- **Rollup**: MiniEVM on Initia testnet (`initiation-2`) via Weave CLI.
- **Contracts**: Solidity ^0.8.24, deployed with Foundry. `PulseOracle`, `PulseGate`, `PulseGov`.
- **Frontend**: Next.js 16, TypeScript, InterwovenKit v2, wagmi, TanStack Query.
- **Routing engine**: deterministic intent parser + composite scoring, zero external ML dependency on the routing path. Covered by a vitest suite and a sanity script against live registry profiles.
- **AI (Ask Pulse only)**: Multi-provider (Anthropic, OpenAI, Ollama, LM Studio, Groq, or any OpenAI-compatible API), used for brief generation and action-card parsing — never on the routing decision itself.

---

### Local Dev Limitation

The rollup (`initia-pulse-1`) runs locally via the Weave CLI and is **not registered on the Initia explorer or bridge UI**. This is a limitation for local rollups (https://docs.initia.xyz/hackathon/examples/evm-bank#-native-feature-interwoven-bridge).

**What this means in practice:**

- The **Interwoven Bridge** is fully implemented in code via InterwovenKit's `openBridge()` hook (five integration points across the app), but the bridge modal won't list `initia-pulse-1` as a destination on the public bridge UI.
- **This does not affect core functionality.** Pulse's value is read-only intelligence: the AI agent writes oracle snapshots using a backend signer key, and the router, `/proof`, and Ask Pulse all work independently of user-bridged assets.
- **Auto-sign actions (send, stake, bridge, vote) execute on L1 testnet** (`initiation-2`) and work on the live site regardless of the local rollup limitation.
- **Intended production flow:** In a registered-rollup scenario, users can move INIT between L1 and any rollup. `PulseOracle` data remains freely readable by any contract or frontend without bridging.

**Live demo:** [initiapulse.vercel.app](https://initiapulse.vercel.app) — the full app runs with cached oracle data. The rollup + oracle write flow is demonstrated in the [demo video](https://youtu.be/r3Uz-rFKzm0).

---

### Oracle Cron Schedule

The oracle is designed to write snapshots every 5 minutes. For production 5-min intervals:

- **Option A**: Upgrade your hosting infra
- **Option B**: Use an external cron service
- **Local dev**: Use `scripts/oracle-cron.ts`
