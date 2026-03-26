"use client";

import { useQuery } from "@tanstack/react-query";

export interface ChainStatus {
  isLive: boolean;
  blockHeight: number;
  evmBlockHeight: number | null;
  latestBlockTime: string | null;
  secondsAgo: number | null;
  chainId: string;
  evmChainId: string;
  rpcUrl: string;
}

async function fetchChainStatus(): Promise<ChainStatus> {
  const res = await fetch("/api/chain-status", { cache: "no-store" });
  if (!res.ok) throw new Error("chain-status unavailable");
  return res.json();
}

export function useChainStatus() {
  return useQuery({
    queryKey: ["chain-status"],
    queryFn: fetchChainStatus,
    staleTime: 8_000,
    refetchInterval: 10_000,
    retry: false,
  });
}
