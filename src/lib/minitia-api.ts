import { apiFetchSafe } from "./initia-client";
import { MinitiaInfo, MinitiaWithMetrics, MinitiaMetrics, TokenAmount } from "./types";

// ─── Rollytics indexer data per minitia ───────────────────────────────────────
async function fetchRolyticsTxCount(indexerUrl: string): Promise<number> {
  const data = await apiFetchSafe<{ pagination: { total: string } }>(
    `${indexerUrl}/indexer/tx/v1/txs?pagination.limit=1&pagination.count_total=true`,
    { pagination: { total: "0" } },
    4000
  );
  return parseInt(data.pagination?.total ?? "0", 10);
}

async function fetchRolyticsAvgBlockTime(indexerUrl: string): Promise<number | undefined> {
  const data = await apiFetchSafe<{ avg_block_time: number }>(
    `${indexerUrl}/indexer/block/v1/avg_blocktime`,
    { avg_block_time: 0 },
    4000
  );
  return data.avg_block_time > 0 ? data.avg_block_time : undefined;
}

async function fetchRolyticsLatestBlock(indexerUrl: string) {
  const data = await apiFetchSafe<{ blocks: unknown[] }>(
    `${indexerUrl}/indexer/block/v1/blocks?pagination.limit=1&pagination.reverse=true`,
    { blocks: [] },
    4000
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = (data.blocks || [])[0] as any;
  if (!b) return undefined;
  return {
    gasUsed: parseInt(b.gas_used ?? "0", 10),
    gasWanted: parseInt(b.gas_wanted ?? "0", 10),
    txCount: parseInt(b.tx_count ?? "0", 10),
  };
}

async function fetchTotalSupply(restUrl: string): Promise<TokenAmount[]> {
  const data = await apiFetchSafe<{ supply: { denom: string; amount: string }[] }>(
    `${restUrl}/cosmos/bank/v1beta1/supply?pagination.limit=20`,
    { supply: [] },
    3000
  );
  return (data.supply ?? []).filter(s => s.amount !== "0");
}

// ─── REST metrics per minitia ─────────────────────────────────────────────────
async function fetchRestBlockHeight(restUrl: string): Promise<{ height: number; time: string } | null> {
  const data = await apiFetchSafe<{ block: { header: { height: string; time: string } } }>(
    `${restUrl}/cosmos/base/tendermint/v1beta1/blocks/latest`,
    { block: { header: { height: "0", time: "" } } },
    3000
  );
  const height = parseInt(data.block?.header?.height ?? "0", 10);
  return height > 0 ? { height, time: data.block?.header?.time ?? "" } : null;
}

async function fetchValidatorCount(restUrl: string): Promise<number> {
  const data = await apiFetchSafe<{ pagination: { total: string } }>(
    `${restUrl}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=1`,
    { pagination: { total: "0" } },
    3000
  );
  return parseInt(data.pagination?.total ?? "0", 10);
}

// ─── Aggregate per minitia ────────────────────────────────────────────────────
export async function fetchMinitiaMetrics(minitia: MinitiaInfo): Promise<MinitiaMetrics> {
  const restUrl = minitia.apis.rest[0];
  const base: MinitiaMetrics = {
    chainId: minitia.chainId,
    blockHeight: 0,
    totalTxCount: 0,
    totalSupply: [],
  };

  const tasks = await Promise.allSettled([
    restUrl ? fetchRestBlockHeight(restUrl) : Promise.resolve(null),
    restUrl ? fetchValidatorCount(restUrl) : Promise.resolve(0),
    minitia.indexerUrl ? fetchRolyticsTxCount(minitia.indexerUrl) : Promise.resolve(0),
    minitia.indexerUrl ? fetchRolyticsAvgBlockTime(minitia.indexerUrl) : Promise.resolve(undefined),
    minitia.indexerUrl ? fetchRolyticsLatestBlock(minitia.indexerUrl) : Promise.resolve(undefined),
    restUrl ? fetchTotalSupply(restUrl) : Promise.resolve([]),
  ]);

  const blockData   = tasks[0].status === "fulfilled" ? tasks[0].value : null;
  const valCount    = tasks[1].status === "fulfilled" ? tasks[1].value : 0;
  const txCount     = tasks[2].status === "fulfilled" ? tasks[2].value : 0;
  const avgBlock    = tasks[3].status === "fulfilled" ? tasks[3].value : undefined;
  const latestBlock = tasks[4].status === "fulfilled" ? tasks[4].value : undefined;
  const supply      = tasks[5].status === "fulfilled" ? tasks[5].value : [];

  return {
    ...base,
    blockHeight: blockData?.height ?? 0,
    latestBlockTime: blockData?.time,
    activeValidators: valCount || undefined,
    totalTxCount: txCount,
    totalSupply: supply as TokenAmount[],
    avgBlockTime: avgBlock,
    lastBlockGasUsed: latestBlock?.gasUsed,
    lastBlockGasWanted: latestBlock?.gasWanted,
    lastBlockTxCount: latestBlock?.txCount,
  };
}

export async function fetchAllMinitiaMetrics(minitias: MinitiaInfo[]): Promise<MinitiaWithMetrics[]> {
  const results = await Promise.allSettled(
    minitias.map(async (m) => {
      // Skip metric fetching for mainnet reference chains — they're visual-only
      if (m.isMainnetRef) return { ...m } as MinitiaWithMetrics;
      return { ...m, metrics: await fetchMinitiaMetrics(m) } as MinitiaWithMetrics;
    })
  );
  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : ({ ...minitias[i] } as MinitiaWithMetrics)
  );
}
