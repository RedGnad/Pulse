"use client";

import { useQuery } from "@tanstack/react-query";
import { EcosystemInsights } from "@/lib/ai";

async function fetchInsights(): Promise<EcosystemInsights> {
  const res = await fetch("/api/insights");
  if (!res.ok) throw new Error("insights failed");
  const json = await res.json();
  return json.insights;
}

export function useInsights() {
  return useQuery({
    queryKey: ["insights"],
    queryFn: fetchInsights,
    staleTime: 290_000,   // ~5 min — matches server revalidate
    refetchInterval: 300_000,
    retry: false,
  });
}
