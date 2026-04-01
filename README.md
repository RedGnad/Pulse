# Initia Pulse

## Initia Hackathon Submission

- **Project Name**: Initia Pulse

### Project Overview

Initia Pulse is an AI-powered on-chain intelligence layer for the Initia ecosystem. It continuously monitors all minitia rollups, IBC channels, validators, and bridge activity, then generates AI insights that are written as immutable snapshots to the PulseOracle smart contract on its own EVM rollup. Any contract or dApp on Initia can read live ecosystem health data directly on-chain — making Pulse the first oracle that doesn't feed prices, but feeds intelligence.

### Implementation Detail

- **The Custom Implementation**: PulseOracle is a composable Solidity contract deployed on a dedicated MiniEVM rollup (`initia-pulse-1`). Every 5 minutes, an AI agent analyzes live data from 13+ minitias, 19 validators, and all IBC channels, then writes a compressed ecosystem snapshot on-chain — including a `dataHash` (keccak256 commitment) for integrity verification. The contract exposes DeFi-composable primitives: `isHealthy(minHealth, minStreak)` lets any lending protocol gate operations on ecosystem stability, `healthStreak()` enables risk scoring, and a multi-writer role system (`setWriter`) allows multiple AI agents to contribute. The frontend provides real-time dashboards, an AI advisor for deploy/stake/bridge decisions, and a full oracle history explorer.

- **The Native Feature**: The Interwoven Bridge is integrated via InterwovenKit's `openBridge` hook, allowing users to bridge INIT tokens from L1 (initiation-2) directly to the Pulse rollup. The bridge is accessible from 5 entry points: the bridge widget, Ask Pulse chat (contextual), floating chat, wallet portfolio, and chain detail panel.

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

4. **Open `http://localhost:3000`** — connect your wallet via InterwovenKit, explore the dashboard, oracle snapshots, AI advisor, and bridge.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Next.js Frontend (InterwovenKit + wagmi)   │
│  Dashboard · Oracle · Ask · Advisor         │
└──────────────┬──────────────────────────────┘
               │ API routes
┌──────────────▼──────────────────────────────┐
│  AI Engine (Anthropic / OpenAI / Local LLM)  │
│  Ecosystem analysis · Advisor · Chat        │
└──────────────┬──────────────────────────────┘
               │ ethers.js
┌──────────────▼──────────────────────────────┐
│  PulseOracle.sol (MiniEVM rollup)           │
│  writeSnapshot · isHealthy · healthStreak   │
│  latest · getSnapshot · getHistory[50]      │
│  Chain: initia-pulse-1 · Bridge ID: 1691    │
└─────────────────────────────────────────────┘
```

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

- **Rollup**: MiniEVM on Initia testnet (initiation-2) via Weave CLI
- **Contract**: Solidity ^0.8.24, deployed with Foundry
- **Frontend**: Next.js 16, TypeScript, InterwovenKit v2, wagmi, TanStack Query
- **AI**: Multi-provider (Anthropic, OpenAI, Ollama, LM Studio, Groq, or any OpenAI-compatible API), built for multi-agentic analysis
- **Native Feature**: Interwoven Bridge via `openBridge()`

---

### ⚠️ Local Dev Limitation

The rollup (`initia-pulse-1`) runs locally via the Weave CLI and is **not registered on the Initia explorer or bridge UI**. This is a [known limitation for local rollups](https://docs.initia.xyz/hackathon/examples/evm-bank#-native-feature-interwoven-bridge).

**What this means in practice:**

- The **Interwoven Bridge** is fully implemented in code via InterwovenKit's `openBridge()` hook (5 integration points across the app), but the bridge modal won't list `initia-pulse-1` as a destination on the public bridge UI.
- **This does not affect core functionality.** Pulse's value is read-only intelligence: the AI agent writes oracle snapshots using a backend signer key, and all dashboards, AI advisor, and chat features work independently of user-bridged assets. No user needs to bridge tokens to use Pulse.
- **Intended production flow:** In a registered rollup scenario, users would bridge INIT from L1 → Pulse rollup via the bridge widget, then interact with the PulseOracle contract directly. The bridge integration is ready for this — it just requires chain registration on the Initia bridge UI.

**Live demo:** [initiapulse.vercel.app](https://initiapulse.vercel.app) — the full app runs with cached oracle data and AI insights. The rollup + oracle write flow is demonstrated in the [demo video](https://youtu.be/r3Uz-rFKzm0).

---
