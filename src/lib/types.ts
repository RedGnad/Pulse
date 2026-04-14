// ─── L1 Block (from indexer.initia.xyz) ──────────────────────────────────────
export interface L1Block {
  hash: string;
  height: number;
  timestamp: string;
  tx_count: number;
  proposer: {
    moniker: string;
    operator_address: string;
  };
}

// ─── L1 Transaction (from indexer.initia.xyz) ────────────────────────────────
export interface L1Tx {
  hash: string;
  height: number;
  timestamp: string;
  sender: string;
  success: boolean;
  is_ibc: boolean;
  is_opinit: boolean;
}

// ─── OPinit Bridge (from rest.initia.xyz/opinit/ophost/v1/bridges) ───────────
export interface OpinitBridge {
  bridge_id: number;
  bridge_addr: string;
  proposer: string;
  challenger: string;
  batch_info: {
    submitter: string;
    chain_type: string; // "INITIA" | "CELESTIA"
  };
  config: {
    challenger: string;
    proposer: string;
    submission_interval: string;  // e.g. "3600s"
    finalization_period: string;  // e.g. "604800s"
    oracle_enabled: boolean;
  };
  l1_sequence: string;
  l2_sequence: string;
}

// ─── L1 Validator (from initia/mstaking) ─────────────────────────────────────
export interface L1Validator {
  operator_address: string;
  moniker: string;
  status: string;
  jailed: boolean;
  voting_power: string;
  commission_rate: string;
  tokens: { denom: string; amount: string }[];
  missed_blocks?: number;
}

// ─── Governance Proposal ──────────────────────────────────────────────────────
export interface Proposal {
  id: string;
  title: string;
  status: "PROPOSAL_STATUS_PASSED" | "PROPOSAL_STATUS_REJECTED" | "PROPOSAL_STATUS_VOTING_PERIOD" | "PROPOSAL_STATUS_FAILED" | string;
  submit_time: string;
  voting_end_time: string;
  final_tally_result?: {
    yes_count: string;
    no_count: string;
    abstain_count: string;
    no_with_veto_count: string;
  };
}

export interface ProposalTally {
  yes_count: string;
  no_count: string;
  abstain_count: string;
  no_with_veto_count: string;
}

export interface ValidatorVote {
  voter: string;      // cosmos address
  moniker?: string;   // resolved from validator set
  option: string;     // VOTE_OPTION_YES | NO | ABSTAIN | NO_WITH_VETO
  weight: string;
}

export interface GovernanceAnalysis {
  proposal_id: string;
  recommendation: "YES" | "NO" | "ABSTAIN" | "VETO";
  confidence: number;            // 0–100
  rationale: string;             // 2-3 sentences, grounded in ecosystem data
  ecosystem_impact: "positive" | "neutral" | "negative";
  risk_factors: string[];
  generated_at: string;
}

export interface ProposalFull extends Proposal {
  summary?: string;              // extracted from messages or metadata
  type?: string;                 // e.g. "MsgSoftwareUpgrade"
  live_tally?: ProposalTally;
  validator_votes?: ValidatorVote[];
  analysis?: GovernanceAnalysis;
}

// ─── Minitia (from registry + Rollytics) ─────────────────────────────────────
export interface MinitiaInfo {
  chainId: string;
  name: string;
  prettyName: string;
  status: "live" | "upcoming" | "killed";
  networkType: "mainnet" | "testnet";
  apis: {
    rest: string[];
    rpc: string[];
    api: string[];
  };
  indexerUrl?: string;
  explorerUrl?: string;
  logoUrl?: string;
  bridgeId?: number;
  /** True for initia-pulse-1 — our own rollup deployed for this hackathon */
  isOurs?: boolean;
  /** True for mainnet chains shown as visual reference (greyed out, not interactive data) */
  isMainnetRef?: boolean;
}

export interface MinitiaMetrics {
  chainId: string;
  blockHeight: number;
  totalTxCount: number;
  avgBlockTime?: number; // seconds
  totalSupply: TokenAmount[];
  activeValidators?: number;
  latestBlockTime?: string;
  // Rollytics block metrics
  lastBlockGasUsed?: number;
  lastBlockGasWanted?: number;
  lastBlockTxCount?: number;
}

export interface PulseScore {
  activity: number;
  settlement: number;
  bridge: number;
  growth: number;
  uptime: number;
  total: number;
}

export interface MinitiaWithMetrics extends MinitiaInfo {
  metrics?: MinitiaMetrics;
  bridgeId?: number; // OPinit bridge_id linking this minitia to L1
  pulseScore?: PulseScore;
}

export interface TokenAmount {
  denom: string;
  amount: string;
}

export interface IbcChannel {
  sourceChainId: string;
  destChainId: string;
  portId: string;
  channelId: string;
  version: string;
}

// ─── Ecosystem Overview ───────────────────────────────────────────────────────
export interface EcosystemOverview {
  l1: {
    chainId: string;
    blockHeight: number;
    totalTxCount: number;
    latestBlockTx?: number;
    recentBlocks: L1Block[];
    validators: L1Validator[];
    totalValidators: number;
    activeProposals: number;
    proposals: Proposal[];
  };
  minitias: MinitiaWithMetrics[];
  bridges: OpinitBridge[];
  ibcChannels: IbcChannel[];
  totalMinitias: number;
  totalIbcChannels: number;
  lastUpdated: string;
}

// ─── PulseAdvisor ─────────────────────────────────────────────────────────────
export type AdvisorType = "deploy" | "stake" | "bridge";

export interface DeployAdvice {
  top_chain: { chainId: string; prettyName: string; score: number; reason: string };
  alternatives: { chainId: string; prettyName: string; score: number; reason: string }[];
  rationale: string;
  warnings: string[];
}

export interface StakeAdvice {
  recommendations: { moniker: string; operator_address: string; score: number; rationale: string; risks: string[] }[];
  strategy: string;
  warnings: string[];
}

export interface BridgeAdvice {
  path: string[];
  total_time: string;
  steps: { action: string; time: string; note: string }[];
  rationale: string;
}

export type AdvisorAdvice = DeployAdvice | StakeAdvice | BridgeAdvice;

// ─── AI Chat ─────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}
