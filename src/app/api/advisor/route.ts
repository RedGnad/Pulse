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

export async function POST(req: Request) {
  let body: { type: AdvisorType; params: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, params } = body;
  if (!["deploy", "stake", "bridge"].includes(type)) {
    return NextResponse.json({ error: "Invalid advisor type" }, { status: 400 });
  }

  try {
    // Fetch base ecosystem data + oracle history in parallel.
    // Oracle history is optional — graceful fallback to null if initia-pulse-1 is offline.
    const [[{ minitias, ibcChannels }, l1Raw], oracleHistory] = await Promise.all([
      Promise.all([fetchEcosystemData(), fetchL1Data()]),
      readOracleHistory(2500),
    ]);

    if (type === "deploy") {
      const minitiasWith = await fetchAllMinitiaMetrics(minitias);
      const appType = typeof params.appType === "string" ? params.appType : "General dApp";
      const needs   = Array.isArray(params.needs) ? (params.needs as string[]) : [];
      const advice = await generateDeployAdvice(
        minitiasWith, l1Raw.bridges, ibcChannels, { appType, needs }, oracleHistory ?? undefined
      );
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
