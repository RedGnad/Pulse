/**
 * GET /api/chain-status
 * Returns live stats from our own initia-pulse-1 EVM rollup.
 * Used to prove the chain is running on the oracle page.
 */

import { NextResponse } from "next/server";

const REST_URL = process.env.PULSE_REST_URL ?? "http://127.0.0.1:1317";
const EVM_RPC  = process.env.PULSE_EVM_RPC  ?? "http://127.0.0.1:8545";

async function fetchWithTimeout(url: string, body?: object, timeoutMs = 3000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

export async function GET() {
  const [cosmosBlock, evmBlock] = await Promise.all([
    fetchWithTimeout(`${REST_URL}/cosmos/base/tendermint/v1beta1/blocks/latest`),
    fetchWithTimeout(EVM_RPC, { jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
  ]);

  const blockHeight  = parseInt(cosmosBlock?.block?.header?.height ?? "0", 10);
  const blockTime    = cosmosBlock?.block?.header?.time ?? null;
  const evmHeight    = evmBlock?.result ? parseInt(evmBlock.result, 16) : null;

  const isLive = blockHeight > 0;
  const secondsAgo = blockTime
    ? Math.floor((Date.now() - new Date(blockTime).getTime()) / 1000)
    : null;

  return NextResponse.json({
    isLive,
    blockHeight,
    evmBlockHeight: evmHeight,
    latestBlockTime: blockTime,
    secondsAgo,
    chainId: "initia-pulse-1",
    evmChainId: process.env.PULSE_EVM_CHAIN_ID ?? "2150269405855764",
    rpcUrl: EVM_RPC,
  });
}
