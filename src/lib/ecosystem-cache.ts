/**
 * Stale-while-revalidate cache for the ecosystem overview.
 *
 * The upstream fetch is 6-13s (6 minitias × 6 REST/indexer calls, each up
 * to 3s). Hitting that synchronously on every request means the home page
 * shows "CONNECTING TO INITIA…" for the entire duration — unacceptable.
 *
 * Strategy:
 *   - Per-network in-memory cache with a "freshAt" stamp.
 *   - Fresh window (< FRESH_MS): return cached copy immediately.
 *   - Stale window (> FRESH_MS): return cached copy immediately AND kick
 *     off a background refresh (single-flight via inFlight map).
 *   - Cold start: synchronously fetch. We also try to read a seed file
 *     from data/ecosystem-cache-<network>.json so even the first request
 *     after a deploy is instant.
 *   - On every successful background refresh, the new payload is written
 *     back to the seed file so the next cold start stays warm.
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { EcosystemOverview } from "./types";
import type { NetworkMode } from "./initia-client";

const FRESH_MS = 20_000;

interface Entry {
  data: EcosystemOverview;
  freshAt: number;
}

const cache: Partial<Record<NetworkMode, Entry>> = {};
const inFlight: Partial<Record<NetworkMode, Promise<EcosystemOverview>>> = {};

function seedPath(network: NetworkMode): string {
  return path.join(process.cwd(), "data", `ecosystem-cache-${network}.json`);
}

async function loadSeedFromDisk(network: NetworkMode): Promise<Entry | null> {
  try {
    const raw = await fs.readFile(seedPath(network), "utf8");
    const data = JSON.parse(raw) as EcosystemOverview;
    // Mark seed as stale so the first request triggers a background refresh
    return { data, freshAt: 0 };
  } catch {
    return null;
  }
}

async function persistSeed(network: NetworkMode, data: EcosystemOverview): Promise<void> {
  try {
    const p = seedPath(network);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(data), "utf8");
  } catch (err) {
    console.warn("[ecosystem-cache] persist failed:", err);
  }
}

/**
 * Fetch the ecosystem overview through the SWR cache.
 * `builder` is the slow path — we only call it when we have nothing, or
 * as a background refresh when the cache is stale.
 */
export async function getEcosystemCached(
  network: NetworkMode,
  builder: () => Promise<EcosystemOverview>,
): Promise<{ data: EcosystemOverview; source: "fresh" | "stale" | "cold" }> {
  // Try to rehydrate from disk on first access
  if (!cache[network]) {
    const seeded = await loadSeedFromDisk(network);
    if (seeded) cache[network] = seeded;
  }

  const entry = cache[network];
  const now = Date.now();

  // Fresh hit — return immediately
  if (entry && now - entry.freshAt < FRESH_MS) {
    return { data: entry.data, source: "fresh" };
  }

  // Stale hit — return immediately AND trigger background refresh
  if (entry) {
    refreshInBackground(network, builder);
    return { data: entry.data, source: "stale" };
  }

  // Cold — must wait for the fetch
  const data = await singleFlight(network, builder);
  return { data, source: "cold" };
}

function refreshInBackground(network: NetworkMode, builder: () => Promise<EcosystemOverview>): void {
  if (inFlight[network]) return; // already refreshing
  singleFlight(network, builder).catch(err => {
    console.warn("[ecosystem-cache] background refresh failed:", err);
  });
}

async function singleFlight(network: NetworkMode, builder: () => Promise<EcosystemOverview>): Promise<EcosystemOverview> {
  const existing = inFlight[network];
  if (existing) return existing;

  const p = (async () => {
    try {
      const data = await builder();
      cache[network] = { data, freshAt: Date.now() };
      // Persist without blocking the response
      void persistSeed(network, data);
      return data;
    } finally {
      delete inFlight[network];
    }
  })();

  inFlight[network] = p;
  return p;
}
