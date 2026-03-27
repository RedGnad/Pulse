"use client";

import { useQuery } from "@tanstack/react-query";
import { EcosystemOverview } from "@/lib/types";
import { useNetwork } from "@/contexts/network-context";

async function fetchEcosystem(network: string): Promise<EcosystemOverview> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(`/api/ecosystem?network=${network}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error("fetch failed");
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

export function useEcosystem() {
  const { network } = useNetwork();
  return useQuery({
    queryKey: ["ecosystem", network],
    queryFn: () => fetchEcosystem(network),
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
