import { apiFetch, apiFetchSafe, apiFetchNoCache, L1_REST, L1_INDEX, getL1Urls, type NetworkMode } from "./initia-client";
import { L1Block, L1Validator, OpinitBridge, Proposal, ProposalTally, ValidatorVote } from "./types";

// ─── Blocks (indexer, with REST fallback) ─────────────────────────────────────
export async function fetchRecentBlocks(limit = 10, network?: NetworkMode): Promise<L1Block[]> {
  const { index, rest } = getL1Urls(network);

  // Try indexer first
  const data = await apiFetchSafe<{ blocks: unknown[] }>(
    `${index}/indexer/block/v1/blocks?pagination.limit=${limit}&pagination.reverse=true`,
    { blocks: [] }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indexerBlocks = (data.blocks || []).map((b: any) => ({
    hash: b.hash ?? "",
    height: parseInt(b.height ?? "0", 10),
    timestamp: b.timestamp ?? "",
    tx_count: parseInt(b.tx_count ?? "0", 10),
    proposer: {
      moniker: b.proposer?.moniker ?? b.proposer?.operator_address?.slice(0, 10) ?? "unknown",
      operator_address: b.proposer?.operator_address ?? "",
    },
  }));

  if (indexerBlocks.length > 0) return indexerBlocks;

  // Fallback: fetch recent blocks from REST (one-by-one, limited batch)
  const restLimit = Math.min(limit, 8);
  const latest = await apiFetchSafe<{ block: { header: { height: string } } }>(
    `${rest}/cosmos/base/tendermint/v1beta1/blocks/latest`,
    { block: { header: { height: "0" } } }
  );
  const latestHeight = parseInt(latest.block?.header?.height ?? "0", 10);
  if (latestHeight === 0) return [];

  const heights = Array.from({ length: restLimit }, (_, i) => latestHeight - i);
  const results = await Promise.allSettled(
    heights.map(h =>
      apiFetch<{ block_id: { hash: string }; block: { header: { height: string; time: string; proposer_address: string }; data: { txs: unknown[] } } }>(
        `${rest}/cosmos/base/tendermint/v1beta1/blocks/${h}`, 5000
      )
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ block_id: { hash: string }; block: { header: { height: string; time: string; proposer_address: string }; data: { txs: unknown[] } } }> => r.status === "fulfilled")
    .map(r => ({
      hash: r.value.block_id?.hash ?? "",
      height: parseInt(r.value.block.header.height, 10),
      timestamp: r.value.block.header.time,
      tx_count: r.value.block.data.txs?.length ?? 0,
      proposer: {
        moniker: r.value.block.header.proposer_address?.slice(0, 10) ?? "unknown",
        operator_address: r.value.block.header.proposer_address ?? "",
      },
    }));
}

export async function fetchL1TxCount(network?: NetworkMode): Promise<number> {
  const { index } = getL1Urls(network);
  const data = await apiFetchSafe<{ pagination: { total: string } }>(
    `${index}/indexer/tx/v1/txs?pagination.limit=1&pagination.count_total=true`,
    { pagination: { total: "0" } }
  );
  return parseInt(data.pagination?.total ?? "0", 10);
}

export async function fetchL1BlockHeight(network?: NetworkMode): Promise<number> {
  const { rest } = getL1Urls(network);
  const data = await apiFetchSafe<{ block: { header: { height: string } } }>(
    `${rest}/cosmos/base/tendermint/v1beta1/blocks/latest`,
    { block: { header: { height: "0" } } }
  );
  return parseInt(data.block?.header?.height ?? "0", 10);
}

// ─── Validators (mstaking) ────────────────────────────────────────────────────
export async function fetchValidators(network?: NetworkMode): Promise<{ validators: L1Validator[]; total: number }> {
  const { rest } = getL1Urls(network);
  const data = await apiFetchSafe<{ validators: unknown[]; pagination: { total: string } }>(
    `${rest}/initia/mstaking/v1/validators?status=BOND_STATUS_BONDED&pagination.limit=50`,
    { validators: [], pagination: { total: "0" } }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validators: L1Validator[] = (data.validators || []).map((v: any) => ({
    operator_address: v.operator_address ?? "",
    moniker: v.description?.moniker ?? "unknown",
    status: v.status ?? "",
    jailed: v.jailed ?? false,
    voting_power: v.voting_power ?? "0",
    commission_rate: v.commission?.commission_rates?.rate ?? "0",
    tokens: Array.isArray(v.tokens)
      ? v.tokens.map((t: { denom: string; amount: string }) => ({ denom: t.denom, amount: t.amount }))
      : [],
  }));

  const total = parseInt(data.pagination?.total ?? "0", 10);
  return {
    validators,
    total: total > 0 ? total : validators.length,
  };
}

// ─── User balance ────────────────────────────────────────────────────────────
export async function fetchUserBalance(
  address: string,
  network?: NetworkMode,
): Promise<{ denom: string; amount: string }[]> {
  const { rest } = getL1Urls(network);
  try {
    const data = await apiFetchNoCache<{ balances: { denom: string; amount: string }[] }>(
      `${rest}/cosmos/bank/v1beta1/balances/${address}`,
    );
    return data.balances || [];
  } catch {
    return [];
  }
}

// ─── User delegations (mstaking) ─────────────────────────────────────────────
export interface UserDelegation {
  validatorAddress: string;
  validatorMoniker: string;
  amount: string;
  denom: string;
}

export async function fetchUserDelegations(
  address: string,
  validators: L1Validator[],
  network?: NetworkMode,
): Promise<UserDelegation[]> {
  const { rest } = getL1Urls(network);
  let data: { delegation_responses: unknown[] };
  try {
    data = await apiFetchNoCache<{ delegation_responses: unknown[] }>(
      `${rest}/initia/mstaking/v1/delegations/${address}`,
    );
  } catch {
    data = { delegation_responses: [] };
  }
  const monikerMap = new Map(validators.map((v) => [v.operator_address, v.moniker]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.delegation_responses || []).flatMap((d: any) => {
    const valAddr = d.delegation?.validator_address ?? "";
    return (d.balance || []).map((b: { denom: string; amount: string }) => ({
      validatorAddress: valAddr,
      validatorMoniker: monikerMap.get(valAddr) ?? valAddr.slice(0, 20) + "…",
      amount: b.amount,
      denom: b.denom,
    }));
  });
}

// ─── OPinit Bridges (the Interwoven Bridge data) ──────────────────────────────
export async function fetchBridges(network?: NetworkMode): Promise<OpinitBridge[]> {
  const { rest } = getL1Urls(network);
  const data = await apiFetchSafe<{ bridges: unknown[] }>(
    `${rest}/opinit/ophost/v1/bridges?pagination.limit=100`,
    { bridges: [] }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.bridges || []).map((b: any) => ({
    bridge_id: parseInt(b.bridge_id ?? "0", 10),
    bridge_addr: b.bridge_addr ?? "",
    proposer: b.proposer ?? "",
    challenger: b.challenger ?? "",
    batch_info: {
      submitter: b.batch_info?.submitter ?? "",
      chain_type: b.batch_info?.chain_type ?? "INITIA",
    },
    config: {
      challenger: b.bridge_config?.challenger ?? "",
      proposer: b.bridge_config?.proposer ?? "",
      submission_interval: b.bridge_config?.submission_interval ?? "0s",
      finalization_period: b.bridge_config?.finalization_period ?? "0s",
      oracle_enabled: b.bridge_config?.oracle_enabled ?? false,
    },
    l1_sequence: b.l1_sequence ?? "0",
    l2_sequence: b.l2_sequence ?? "0",
  }));
}

// ─── Governance ───────────────────────────────────────────────────────────────
export async function fetchProposals(limit = 20, network?: NetworkMode): Promise<{ proposals: Proposal[]; total: number }> {
  const { rest } = getL1Urls(network);
  const data = await apiFetchSafe<{ proposals: unknown[]; pagination: { total: string } }>(
    `${rest}/cosmos/gov/v1/proposals?pagination.limit=${limit}&pagination.reverse=true`,
    { proposals: [], pagination: { total: "0" } }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proposals: Proposal[] = (data.proposals || []).map((p: any) => ({
    id: p.id ?? "0",
    title: p.title ?? p.messages?.[0]?.["@type"]?.split(".").pop() ?? "Unknown",
    status: p.status ?? "",
    submit_time: p.submit_time ?? "",
    voting_end_time: p.voting_end_time ?? "",
    final_tally_result: p.final_tally_result,
  }));

  return {
    proposals,
    total: parseInt(data.pagination?.total ?? String(proposals.length), 10),
  };
}

export async function fetchProposalDetail(id: string): Promise<{
  title: string;
  summary: string;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
} | null> {
  const data = await apiFetchSafe<{ proposal: unknown }>(
    `${L1_REST}/cosmos/gov/v1/proposals/${id}`,
    { proposal: null }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = data.proposal as any;
  if (!p) return null;
  const firstMsg = p.messages?.[0];
  const msgType: string = firstMsg?.["@type"]?.split(".").pop() ?? "Unknown";
  return {
    title: p.title ?? msgType,
    summary: p.summary ?? p.metadata ?? "",
    type: msgType,
    messages: p.messages ?? [],
  };
}

export async function fetchProposalTally(id: string): Promise<ProposalTally | null> {
  const data = await apiFetchSafe<{ tally: unknown }>(
    `${L1_REST}/cosmos/gov/v1/proposals/${id}/tally`,
    { tally: null }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = data.tally as any;
  if (!t) return null;
  return {
    yes_count:         t.yes_count         ?? t.yes         ?? "0",
    no_count:          t.no_count          ?? t.no          ?? "0",
    abstain_count:     t.abstain_count     ?? t.abstain     ?? "0",
    no_with_veto_count: t.no_with_veto_count ?? t.no_with_veto ?? "0",
  };
}

export async function fetchProposalVotes(
  id: string,
  validators: L1Validator[],
  limit = 100
): Promise<ValidatorVote[]> {
  const data = await apiFetchSafe<{ votes: unknown[] }>(
    `${L1_REST}/cosmos/gov/v1/proposals/${id}/votes?pagination.limit=${limit}`,
    { votes: [] }
  );
  const monikerMap = new Map(validators.map(v => [v.operator_address, v.moniker]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.votes || []).map((v: any) => {
    const option = v.options?.[0]?.option ?? v.option ?? "VOTE_OPTION_ABSTAIN";
    const weight  = v.options?.[0]?.weight ?? "1.0";
    return {
      voter: v.voter ?? "",
      moniker: monikerMap.get(v.voter) ?? undefined,
      option,
      weight,
    };
  });
}

// ─── Token supply ─────────────────────────────────────────────────────────────
export async function fetchInitSupply(): Promise<string> {
  const data = await apiFetchSafe<{ amount: { amount: string } }>(
    `${L1_REST}/cosmos/bank/v1beta1/supply/by_denom?denom=uinit`,
    { amount: { amount: "0" } }
  );
  return data.amount?.amount ?? "0";
}

// ─── Latest block tx count (REST — reliable, unlike indexer) ─────────────────
export async function fetchLatestBlockTxCount(network?: NetworkMode): Promise<number> {
  const { rest } = getL1Urls(network);
  const data = await apiFetchSafe<{ block: { data: { txs: unknown[] } } }>(
    `${rest}/cosmos/base/tendermint/v1beta1/blocks/latest`,
    { block: { data: { txs: [] } } }
  );
  return data.block?.data?.txs?.length ?? 0;
}

// ─── Initia Username resolution (.init) ──────────────────────────────────────
const USERNAMES_MODULE: Record<string, string> = {
  testnet: "0x42cd8467b1c86e59bf319e5664a09b6b5840bb3fac64f5ce690b5041c530565a",
  mainnet: "0x72ed9b26ecdcd6a21d304df50f19abfdbe31d2c02f60c84627844620a45940ef",
};

/** Resolve a .init username to a bech32 address via Move view function */
export async function resolveInitUsername(
  name: string,
  network: NetworkMode = "testnet",
): Promise<string | null> {
  const { rest } = getL1Urls(network);
  const moduleAddr = USERNAMES_MODULE[network];
  // BCS encode string: ULEB128 length prefix + UTF-8 bytes, then base64
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(name);
  const bcsBytes = new Uint8Array([nameBytes.length, ...nameBytes]);
  const base64Arg = Buffer.from(bcsBytes).toString("base64");

  try {
    const res = await fetch(`${rest}/initia/move/v1/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: moduleAddr,
        module_name: "usernames",
        function_name: "get_address_from_name",
        type_args: [],
        args: [base64Arg],
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Response is like { data: "\"init1abc...\"" } or { data: "null" }
    const raw = data?.data;
    if (!raw || raw === "null") return null;
    const addr = raw.replace(/"/g, "");
    if (addr.startsWith("init1") && addr.length === 43) return addr;
    return null;
  } catch {
    return null;
  }
}

// ─── Aggregate L1 data ────────────────────────────────────────────────────────
export async function fetchL1Data(network?: NetworkMode) {
  const [recentBlocks, txCount, blockHeight, validatorData, bridges, latestBlockTx] = await Promise.allSettled([
    fetchRecentBlocks(20, network),
    fetchL1TxCount(network),
    fetchL1BlockHeight(network),
    fetchValidators(network),
    fetchBridges(network),
    fetchLatestBlockTxCount(network),
  ]);

  return {
    recentBlocks:    recentBlocks.status === "fulfilled" ? recentBlocks.value : [],
    txCount:         txCount.status === "fulfilled" ? txCount.value : 0,
    blockHeight:     blockHeight.status === "fulfilled" ? blockHeight.value : 0,
    validators:      validatorData.status === "fulfilled" ? validatorData.value.validators : [],
    totalValidators: validatorData.status === "fulfilled" ? validatorData.value.total : 0,
    bridges:         bridges.status === "fulfilled" ? bridges.value : [],
    latestBlockTx:   latestBlockTx.status === "fulfilled" ? latestBlockTx.value : 0,
  };
}
