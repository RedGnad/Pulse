import { createConfig, CreateConnectorFn, http } from "wagmi";
import { defineChain } from "viem";

/* ── Initia L1 (testnet) ── */
export const initiaTestnet = defineChain({
  id: 7701,
  name: "Initia Testnet",
  nativeCurrency: { name: "INIT", symbol: "INIT", decimals: 6 },
  rpcUrls: { default: { http: ["https://json-rpc.testnet.initia.xyz"] } },
  blockExplorers: {
    default: { name: "Initia Explorer", url: "https://scan.testnet.initia.xyz/initiation-2" },
  },
});

/* ── Initia Pulse rollup (EVM on initia-pulse-1) ── */
const PULSE_EVM_ID = Number(process.env.NEXT_PUBLIC_PULSE_EVM_CHAIN_ID ?? "2150269405855764");
const PULSE_JSON_RPC = process.env.NEXT_PUBLIC_PULSE_JSON_RPC ?? "http://localhost:8545";

export const initiaPulse = defineChain({
  id: PULSE_EVM_ID,
  name: "Initia Pulse",
  nativeCurrency: { name: "PULSE", symbol: "PULSE", decimals: 18 },
  rpcUrls: { default: { http: [PULSE_JSON_RPC] } },
});

/* ── Shared transport config ── */
const transports = {
  [initiaTestnet.id]: http("https://json-rpc.testnet.initia.xyz"),
  [initiaPulse.id]: http(PULSE_JSON_RPC),
};

/* ── Build connector list — privy loaded at call-time to avoid module-level fetch crash ── */
function buildConnectors(): CreateConnectorFn[] {
  const list: CreateConnectorFn[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const privy = require("@initia/interwovenkit-react").initiaPrivyWalletConnector;
    if (privy) list.push(privy as CreateConnectorFn);
  } catch {
    // InterwovenKit unavailable or network down — proceed without it
  }
  return list;
}

/* ── Export config — fallback to injected-only if privy fails ── */
export let wagmiConfig: ReturnType<typeof createConfig>;
try {
  wagmiConfig = createConfig({
    chains: [initiaTestnet, initiaPulse],
    connectors: buildConnectors(),
    multiInjectedProviderDiscovery: true,
    transports,
    ssr: true,
  });
} catch {
  wagmiConfig = createConfig({
    chains: [initiaTestnet, initiaPulse],
    connectors: [],
    multiInjectedProviderDiscovery: true,
    transports,
    ssr: true,
  });
}
