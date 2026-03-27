import { apiFetch, apiFetchSafe, L1_REST, L1_INDEX, getL1Urls, type NetworkMode } from "./initia-client";
import { L1Block, L1Validator, OpinitBridge, Proposal, ProposalTally, ValidatorVote } from "./types";

// ─── Blocks (indexer) ─────────────────────────────────────────────────────────
export async function fetchRecentBlocks(limit = 10, network?: NetworkMode): Promise<L1Block[]> {
  const { index } = getL1Urls(network);
  const data = await apiFetchSafe<{ blocks: unknown[] }>(
    `${index}/indexer/block/v1/blocks?pagination.limit=${limit}&pagination.reverse=true`,
    { blocks: [] }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.blocks || []).map((b: any) => ({
    hash: b.hash ?? "",
    height: parseInt(b.height ?? "0", 10),
    timestamp: b.timestamp ?? "",
    tx_count: parseInt(b.tx_count ?? "0", 10),
    proposer: {
      moniker: b.proposer?.moniker ?? b.proposer?.operator_address?.slice(0, 10) ?? "unknown",
      operator_address: b.proposer?.operator_address ?? "",
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

// ─── Aggregate L1 data ────────────────────────────────────────────────────────
export async function fetchL1Data(network?: NetworkMode) {
  const [recentBlocks, txCount, blockHeight, validatorData, bridges] = await Promise.allSettled([
    fetchRecentBlocks(20, network),
    fetchL1TxCount(network),
    fetchL1BlockHeight(network),
    fetchValidators(network),
    fetchBridges(network),
  ]);

  return {
    recentBlocks:    recentBlocks.status === "fulfilled" ? recentBlocks.value : [],
    txCount:         txCount.status === "fulfilled" ? txCount.value : 0,
    blockHeight:     blockHeight.status === "fulfilled" ? blockHeight.value : 0,
    validators:      validatorData.status === "fulfilled" ? validatorData.value.validators : [],
    totalValidators: validatorData.status === "fulfilled" ? validatorData.value.total : 0,
    bridges:         bridges.status === "fulfilled" ? bridges.value : [],
  };
}
