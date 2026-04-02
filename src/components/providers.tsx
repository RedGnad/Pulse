"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";
import { NetworkProvider } from "@/contexts/network-context";
import {
  InterwovenKitProvider,
  TESTNET,
  injectStyles,
} from "@initia/interwovenkit-react";
import InterwovenKitStyles from "@initia/interwovenkit-react/styles.js";
import { wagmiConfig } from "@/lib/wagmi-config";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchInterval: 60_000 },
  },
});

/* ── Custom chain definition for InterwovenKit ── */
const PULSE_CHAIN_ID = process.env.NEXT_PUBLIC_PULSE_CHAIN_ID ?? "initia-pulse-1";
const PULSE_DENOM = process.env.NEXT_PUBLIC_PULSE_DENOM ?? "upulse";

const pulseChain = {
  chain_id: PULSE_CHAIN_ID,
  chain_name: "initia-pulse",
  network_type: "testnet" as const,
  bech32_prefix: "init",
  apis: {
    rpc: [{ address: process.env.NEXT_PUBLIC_PULSE_RPC ?? "http://localhost:26657" }],
    rest: [{ address: process.env.NEXT_PUBLIC_PULSE_REST ?? "http://localhost:1317" }],
    indexer: [{ address: process.env.NEXT_PUBLIC_PULSE_INDEXER ?? "http://localhost:8080" }],
    "json-rpc": [{ address: process.env.NEXT_PUBLIC_PULSE_JSON_RPC ?? "http://localhost:8545" }],
  },
  fees: {
    fee_tokens: [{
      denom: PULSE_DENOM,
      fixed_min_gas_price: 0,
      low_gas_price: 0,
      average_gas_price: 0,
      high_gas_price: 0,
    }],
  },
  staking: { staking_tokens: [{ denom: PULSE_DENOM }] },
  native_assets: [{ denom: PULSE_DENOM, name: "Pulse", symbol: "PULSE", decimals: 18 }],
  metadata: { is_l1: false },
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    injectStyles(InterwovenKitStyles);
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <InterwovenKitProvider
          {...TESTNET}
          defaultChainId={PULSE_CHAIN_ID}
          customChain={pulseChain}
          enableAutoSign={{
            "initiation-2": [
              "/cosmos.bank.v1beta1.MsgSend",
              "/initia.mstaking.v1.MsgDelegate",
            ],
            [PULSE_CHAIN_ID]: [
              "/minievm.evm.v1.MsgCall",
            ],
          }}
          autoSignFeePolicy={{
            "initiation-2": { allowedFeeDenoms: ["uinit"] },
            [PULSE_CHAIN_ID]: { allowedFeeDenoms: [PULSE_DENOM] },
          }}
        >
          <NetworkProvider>
            {mounted ? children : null}
          </NetworkProvider>
        </InterwovenKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
