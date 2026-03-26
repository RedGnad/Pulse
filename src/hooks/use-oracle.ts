"use client";

import { useQuery } from "@tanstack/react-query";

export interface SnapshotEntry {
  timestamp: string;
  blockHeight: number;
  activeMinitilas: number;
  ibcChannels: number;
  totalValidators: number;
  totalTxCount: number;
  ecosystemHealth: string;
  brief: string;
}

export interface OracleSnapshot {
  snapshotCount: string;
  onChain: boolean;
  chain: string;
  oracle: string;
  empty?: boolean;
  latest: SnapshotEntry | null;
  history: SnapshotEntry[];
}

async function fetchOracleData(): Promise<OracleSnapshot> {
  const res = await fetch("/api/oracle");
  if (!res.ok) throw new Error("oracle unavailable");
  return res.json();
}

export function useOracle() {
  return useQuery({
    queryKey: ["oracle"],
    queryFn: fetchOracleData,
    staleTime: 290_000,
    refetchInterval: 300_000,
    retry: false,
  });
}
