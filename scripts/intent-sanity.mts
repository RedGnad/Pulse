import { parseIntent, scoreIntentMatch } from "../src/lib/action-routing.ts";
import type { MinitiaWithMetrics } from "../src/lib/types.ts";

function mk(name: string, category: string, description: string, vipActions: { title: string; description: string }[]): MinitiaWithMetrics {
  return {
    chainId: name + "-1", name, prettyName: name, status: "live", networkType: "mainnet",
    apis: { rest: [], rpc: [], api: [] },
    profile: { category, description, vipActions },
  } as MinitiaWithMetrics;
}

const cabal = mk("Cabal", "DeFi",
  "One deposit. Max yield. Zero complexity.",
  [
    { title: "Hold sxINIT", description: "Stake xINIT to mint sxINIT and earn boosted staking and bribe rewards" },
    { title: "Hold Delta Neutral INIT", description: "Deposit iUSD into the Delta Neutral INIT vault" },
  ]);

const echelon = mk("Echelon", "DeFi",
  "A highly efficient money market connecting liquidity and supercharging yields with LST, RWA, and stablecoin backed lending strategies.",
  [
    { title: "Supply", description: "Supply USDC, INIT milkINIT, deINIT, or sxINIT" },
    { title: "Borrow", description: "Borrow USDC or INIT" },
  ]);

const rave = mk("Rave", "DeFi",
  "The pioneer quanto perpetuals protocol: trade anything with everything.",
  [
    { title: "RAVE Trade", description: "Earn esINIT by trading volume with VIP collateral, and earn multiplier boosts for using leverage." },
    { title: "RAVE Cave", description: "Earn esINIT by depositing whitelisted tokens into a Rave Cave." },
  ]);

const inertia = mk("Inertia", "DeFi",
  "The interwoven lending protocol for the modular ecosystem.",
  [
    { title: "Supply & Borrow", description: "Supply and borrow INIT and sINIT on Inertia Lending to earn VIP points." },
  ]);

const milkyway = mk("MilkyWay", "DeFi",
  "The Modular Staking Portal",
  [
    { title: "Liquid stake", description: "Hold milkINIT inside your wallet on either the MilkyWay Rollup (moo-1) or Initia mainnet (interwoven-1) chains." },
    { title: "Supply on Echelon", description: "Supply milkINIT on Echelon" },
    { title: "Supply on Rave", description: "Supply milkINIT on Rave" },
  ]);

const all = [cabal, echelon, rave, inertia, milkyway];

function test(query: string) {
  const intent = parseIntent(query, "trade");
  console.log(`\n"${query}"`);
  console.log(`  parsed: verbs=[${intent.verbs}] assets=[${intent.assets}] mods=[${intent.modifiers}]`);
  const scored = all.map(m => ({ name: m.name, ...scoreIntentMatch(intent, m) }))
    .sort((a, b) => b.score - a.score);
  for (const s of scored) {
    const passes = s.facts.filter(f => f.kind === "pass").map(f => f.label).join(", ");
    console.log(`  ${s.name.padEnd(10)} ${String(s.score).padStart(3)}  ${passes}`);
  }
}

test("I want to borrow USDC");
test("I want to trade ETH perps with leverage");
test("liquid stake INIT");
test("one-click delta neutral vault for USDC");
test("supply milkINIT for yield");
