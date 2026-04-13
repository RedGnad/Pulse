import { NextResponse } from "next/server";
import { readGateStatus } from "@/lib/gate-reader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const status = await readGateStatus();
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "gate read failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
