/**
 * GET /api/governance
 * Fetches active (voting period) governance proposals from Initia L1.
 */

import { NextResponse } from "next/server";
import { fetchProposals } from "@/lib/l1-api";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const network = (searchParams.get("network") as "testnet" | "mainnet") ?? undefined;

  try {
    const { proposals } = await fetchProposals(50, network);
    const active = proposals.filter(
      p => p.status === "PROPOSAL_STATUS_VOTING_PERIOD"
    );
    return NextResponse.json({ proposals: active });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error", proposals: [] },
      { status: 500 }
    );
  }
}
