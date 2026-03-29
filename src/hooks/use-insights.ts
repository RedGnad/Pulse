"use client";

import { useQuery } from "@tanstack/react-query";
import { EcosystemInsights } from "@/lib/ai";
import { useNetwork } from "@/contexts/network-context";

async function fetchInsights(network: string): Promise<EcosystemInsights> {
  const res = await fetch(`/api/insights?network=${network}`);
  if (!res.ok) throw new Error("insights failed");
  const json = await res.json();
  return json.insights;
}

export function useInsights() {
  const { network } = useNetwork();
  return useQuery({
    queryKey: ["insights", network],
    queryFn: () => fetchInsights(network),
    staleTime: 290_000,   // ~5 min — matches server revalidate
    refetchInterval: 300_000,
    retry: false,
  });
}
