/**
 * GET /api/oracle/cron
 * Triggered by Vercel Cron or any external scheduler (e.g. cron-job.org).
 * Authenticates via CRON_SECRET header, then writes a snapshot.
 *
 * NOTE: Oracle writes require access to the rollup EVM RPC (typically localhost:8545).
 * If the rollup isn't reachable from the server, the write will fail gracefully.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Vercel Cron sends the secret in the Authorization header
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Internally call the oracle POST route
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/oracle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.ORACLE_SECRET
          ? { "x-oracle-secret": process.env.ORACLE_SECRET }
          : {}),
      },
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Oracle returned non-JSON response", status: res.status, body: text.slice(0, 200) },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cron failed" },
      { status: 500 }
    );
  }
}
