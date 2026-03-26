/**
 * GET /api/oracle/cron
 * Triggered by Vercel Cron (or any external scheduler).
 * Authenticates via CRON_SECRET header, then writes a snapshot.
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

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cron failed" },
      { status: 500 }
    );
  }
}
