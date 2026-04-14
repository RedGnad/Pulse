import { MinitiaInfo, IbcChannel, MinitiaProfile } from "./types";
import type { NetworkMode } from "./initia-client";

const REGISTRY_BASE =
  "https://raw.githubusercontent.com/initia-labs/initia-registry/main";

interface RegistryChain {
  chain_id: string;
  chain_name: string;
  pretty_name?: string;
  status?: string;
  network_type?: string;
  apis?: {
    rpc?: { address: string }[];
    rest?: { address: string }[];
    api?: { address: string }[];
    indexer?: { address: string }[];
  };
  explorers?: { url: string }[];
  images?: { png?: string; svg?: string }[];
  logo_URIs?: { png?: string; svg?: string };
  metadata?: {
    is_l1?: boolean;
    bridge_id?: string | number;
    op_bridge_id?: string | number;
    op_denoms?: string;
    executor_uri?: string;
    ibc_channels?: {
      chain_id: string;
      port_id: string;
      channel_id: string;
      version: string;
    }[];
  };
}

// Testnet minitias — primary data sources
const TESTNET_MINITIAS: { folder: string; prettyName: string }[] = [
  { folder: "evm", prettyName: "Evm" },
  { folder: "inertia", prettyName: "Inertia" },
  { folder: "move", prettyName: "Move" },
  { folder: "strat", prettyName: "Strat" },
  { folder: "wasm", prettyName: "Wasm" },
];

// Mainnet minitias — greyed-out visual references only
const MAINNET_MINITIAS: { folder: string; prettyName: string }[] = [
  { folder: "blackwing", prettyName: "Blackwing" },
  { folder: "civitia", prettyName: "Civitia" },
  { folder: "echelon", prettyName: "Echelon" },
  { folder: "embr", prettyName: "Embr" },
  { folder: "inertia", prettyName: "Inertia" },
  { folder: "milkyway", prettyName: "MilkyWay" },
  { folder: "moo", prettyName: "Moo" },
  { folder: "noon", prettyName: "Noon" },
  { folder: "rave", prettyName: "Rave" },
  { folder: "tucana", prettyName: "Tucana" },
  { folder: "yominet", prettyName: "YomiNet" },
  { folder: "cabal", prettyName: "Cabal" },
  { folder: "intergaze", prettyName: "Intergaze" },
];

async function fetchChainJson(
  folder: string,
  network: "mainnets" | "testnets" = "mainnets"
): Promise<RegistryChain | null> {
  try {
    const url = `${REGISTRY_BASE}/${network}/${folder}/chain.json`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Raw shape of initia-registry profiles/<slug>.json — we narrow to what we use.
interface RegistryProfile {
  category?: string;
  description?: string;
  summary?: string;
  social?: { website?: string };
  vip?: { actions?: { title: string; description: string }[] };
}

async function fetchProfile(folder: string): Promise<MinitiaProfile | null> {
  try {
    const url = `${REGISTRY_BASE}/profiles/${folder}.json`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const raw = (await res.json()) as RegistryProfile;
    return {
      category: raw.category,
      description: raw.description,
      summary: raw.summary,
      website: raw.social?.website,
      vipActions: raw.vip?.actions,
    };
  } catch {
    return null;
  }
}

function parseChain(chain: RegistryChain, folder: string): MinitiaInfo {
  return {
    chainId: chain.chain_id,
    name: chain.chain_name || folder,
    prettyName: chain.pretty_name || folder,
    status: (chain.status as MinitiaInfo["status"]) || "live",
    networkType:
      (chain.network_type as MinitiaInfo["networkType"]) || "mainnet",
    apis: {
      rest: chain.apis?.rest?.map((r) => r.address) || [],
      rpc: chain.apis?.rpc?.map((r) => r.address) || [],
      api: chain.apis?.api?.map((r) => r.address) || [],
    },
    indexerUrl: chain.apis?.indexer?.[0]?.address,
    explorerUrl: chain.explorers?.[0]?.url,
    bridgeId: (chain.metadata?.op_bridge_id ?? chain.metadata?.bridge_id) ? parseInt(String(chain.metadata.op_bridge_id ?? chain.metadata.bridge_id), 10) : undefined,
    logoUrl:
      chain.images?.[0]?.png ||
      chain.images?.[0]?.svg ||
      chain.logo_URIs?.png ||
      chain.logo_URIs?.svg,
  };
}

function parseIbcChannels(chain: RegistryChain): IbcChannel[] {
  if (!chain.metadata?.ibc_channels) return [];
  return chain.metadata.ibc_channels.map((ch) => ({
    sourceChainId: chain.chain_id,
    destChainId: ch.chain_id,
    portId: ch.port_id,
    channelId: ch.channel_id,
    version: ch.version,
  }));
}

export async function fetchInitiaL1(): Promise<{
  l1: MinitiaInfo;
  ibcChannels: IbcChannel[];
}> {
  const chain = await fetchChainJson("initia", "testnets");
  if (!chain) {
    throw new Error("Failed to fetch Initia L1 (testnet) chain.json");
  }
  return {
    l1: parseChain(chain, "initia"),
    ibcChannels: parseIbcChannels(chain),
  };
}

async function fetchMinitiaList(
  list: { folder: string; prettyName: string }[],
  network: "mainnets" | "testnets",
  isMainnetRef: boolean,
): Promise<MinitiaInfo[]> {
  const results = await Promise.allSettled(
    list.map(async ({ folder, prettyName }) => {
      // Profile only lives on mainnet app-chains. Testnet VM sandboxes
      // (move, evm, wasm, strat-testnet) have no profile by design.
      const [chain, profile] = await Promise.all([
        fetchChainJson(folder, network),
        network === "mainnets" ? fetchProfile(folder) : Promise.resolve(null),
      ]);
      if (chain) {
        const info = parseChain(chain, folder);
        info.prettyName = prettyName;
        if (isMainnetRef) info.isMainnetRef = true;
        if (profile) info.profile = profile;
        return info;
      }
      return null;
    })
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<MinitiaInfo | null> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value)
    .filter((v): v is MinitiaInfo => v !== null);
}

export async function fetchAllMinitias(): Promise<MinitiaInfo[]> {
  return fetchMinitiaList(TESTNET_MINITIAS, "testnets", false);
}

export async function fetchMainnetRefs(): Promise<MinitiaInfo[]> {
  return fetchMinitiaList(MAINNET_MINITIAS, "mainnets", true);
}

// Our own rollup — only injected when env vars are set (i.e. rollup is deployed)
const PULSE_REST = process.env.NEXT_PUBLIC_PULSE_REST;
const PULSE_RPC  = process.env.NEXT_PUBLIC_PULSE_RPC;
const PULSE_CHAIN_ID = process.env.NEXT_PUBLIC_PULSE_CHAIN_ID ?? "initia-pulse-1";

const OUR_MINITIA: MinitiaInfo | null = (PULSE_REST && PULSE_RPC) ? {
  chainId: PULSE_CHAIN_ID,
  name: "initia-pulse",
  prettyName: "Initia Pulse",
  status: "live",
  networkType: "testnet",
  apis: {
    rest: [PULSE_REST],
    rpc:  [PULSE_RPC],
    api:  [],
  },
  isOurs: true,
} : null;

export async function fetchEcosystemData(network: NetworkMode = "testnet") {
  if (network === "mainnet") {
    // Mainnet mode: mainnet chains are primary, no testnet minitias
    const [l1Data, mainnetChains] = await Promise.all([
      fetchChainJson("initia", "mainnets").then(chain => {
        if (!chain) throw new Error("Failed to fetch Initia L1 (mainnet) chain.json");
        return { l1: parseChain(chain, "initia"), ibcChannels: parseIbcChannels(chain) };
      }),
      fetchMinitiaList(MAINNET_MINITIAS, "mainnets", false),
    ]);

    return {
      l1: l1Data.l1,
      minitias: mainnetChains,
      ibcChannels: l1Data.ibcChannels,
    };
  }

  // Testnet mode (default): testnet chains primary, mainnet as refs
  const [l1Data, minitias, mainnetRefs] = await Promise.all([
    fetchInitiaL1(),
    fetchAllMinitias(),
    fetchMainnetRefs(),
  ]);

  const allMinitias = [
    ...(OUR_MINITIA ? [OUR_MINITIA] : []),
    ...minitias,
    ...mainnetRefs,
  ];

  return {
    l1: l1Data.l1,
    minitias: allMinitias,
    ibcChannels: l1Data.ibcChannels,
  };
}
