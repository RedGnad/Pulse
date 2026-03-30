/**
 * POST /api/advisor
 * PulseAdvisor — AI ecosystem navigator grounded in live on-chain data.
 * body: { type: "deploy" | "stake" | "bridge", params: {...} }
 */

import { NextResponse } from "next/server";
import { fetchEcosystemData } from "@/lib/initia-registry";
import { fetchAllMinitiaMetrics } from "@/lib/minitia-api";
import { fetchL1Data } from "@/lib/l1-api";
import { generateDeployAdvice, generateStakeAdvice, generateBridgeAdvice } from "@/lib/ai";
import { AdvisorType } from "@/lib/types";
import { readOracleHistory } from "@/lib/oracle-reader";
import type { NetworkMode } from "@/lib/initia-client";

// Hard cap: abort the entire handler after 30s so the client always gets a response
const ROUTE_TIMEOUT_MS = 30_000;

export async function POST(req: Request) {
  let body: { type: AdvisorType; params: Record<string, unknown>; network?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, params } = body;
  const network = (body.network === "mainnet" ? "mainnet" : "testnet") as NetworkMode;
  if (!["deploy", "stake", "bridge"].includes(type)) {
    return NextResponse.json({ error: "Invalid advisor type" }, { status: 400 });
  }

  // Wrap entire logic in a race against a timeout
  const result = await Promise.race([
    handleAdvisor(type, params, network),
    new Promise<NextResponse>((resolve) =>
      setTimeout(() => resolve(NextResponse.json({ error: "Advisor timed out — try again" }, { status: 504 })), ROUTE_TIMEOUT_MS)
    ),
  ]);
  return result;
}

async function handleAdvisor(
  type: AdvisorType,
  params: Record<string, unknown>,
  network: NetworkMode,
): Promise<NextResponse> {
  try {
    console.log("[advisor] START", type, network);
    console.time("[advisor] fetchData");
    const [[{ minitias, ibcChannels }, l1Raw], oracleHistory] = await Promise.all([
      Promise.all([fetchEcosystemData(network), fetchL1Data(network)]),
      readOracleHistory(2500),
    ]);
    console.timeEnd("[advisor] fetchData");

    if (type === "deploy") {
      console.time("[advisor] fetchMinitiaMetrics");
      const minitiasWith = await fetchAllMinitiaMetrics(minitias);
      console.timeEnd("[advisor] fetchMinitiaMetrics");
      const appType = typeof params.appType === "string" ? params.appType : "General dApp";
      const needs   = Array.isArray(params.needs) ? (params.needs as string[]) : [];
      console.time("[advisor] generateDeployAdvice");
      const advice = await generateDeployAdvice(
        minitiasWith, l1Raw.bridges, ibcChannels, { appType, needs }, oracleHistory ?? undefined
      );
      console.timeEnd("[advisor] generateDeployAdvice");
      return NextResponse.json({ type, advice, oracleGrounded: !!oracleHistory?.length });
    }

    if (type === "stake") {
      const amount      = typeof params.amount === "number" ? params.amount : 100;
      const riskProfile = (params.riskProfile === "conservative" || params.riskProfile === "aggressive")
        ? params.riskProfile : "balanced";
      const advice = await generateStakeAdvice(
        l1Raw.validators, amount, riskProfile, oracleHistory ?? undefined
      );
      return NextResponse.json({ type, advice, oracleGrounded: !!oracleHistory?.length });
    }

    if (type === "bridge") {
      const minitiasWith = await fetchAllMinitiaMetrics(minitias);
      const token     = typeof params.token     === "string" ? params.token     : "INIT";
      const fromChain = typeof params.fromChain === "string" ? params.fromChain : "initiation-2";
      const toChain   = typeof params.toChain   === "string" ? params.toChain   : minitias[0]?.chainId ?? "";
      const advice = await generateBridgeAdvice(
        minitiasWith, l1Raw.bridges, ibcChannels, { token, fromChain, toChain }, oracleHistory ?? undefined
      );
      return NextResponse.json({ type, advice, oracleGrounded: !!oracleHistory?.length });
    }

    return NextResponse.json({ error: "Unhandled type" }, { status: 400 });
  } catch (err) {
    console.error("[advisor]", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
