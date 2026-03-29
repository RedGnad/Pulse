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

2. **Configure environment:** Copy `.env.example` to `.env.local` and set your `ANTHROPIC_API_KEY` and `PULSE_ORACLE_PRIVATE_KEY`.

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
│  AI Engine (Anthropic Claude)               │
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

## Tech Stack

- **Rollup**: MiniEVM on Initia testnet (initiation-2) via Weave CLI
- **Contract**: Solidity ^0.8.24, deployed with Foundry
- **Frontend**: Next.js 16, TypeScript, InterwovenKit v2, wagmi, TanStack Query
- **AI**: Anthropic Claude for ecosystem analysis, chat, and advisor
- **Native Feature**: Interwoven Bridge via `openBridge()`
