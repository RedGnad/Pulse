"use client";

import { useQuery } from "@tanstack/react-query";
import { EcosystemOverview } from "@/lib/types";

async function fetchEcosystem(): Promise<EcosystemOverview> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch("/api/ecosystem", { signal: ctrl.signal });
    if (!res.ok) throw new Error("fetch failed");
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

export function useEcosystem() {
  return useQuery({
    queryKey: ["ecosystem"],
    queryFn: fetchEcosystem,
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
