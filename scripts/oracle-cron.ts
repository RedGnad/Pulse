#!/usr/bin/env npx tsx
/**
 * Oracle snapshot cron — writes ecosystem state on-chain every 5 minutes.
 * Usage: npx tsx scripts/oracle-cron.ts
 *
 * Reads ORACLE_SECRET from env to authenticate with the API.
 * Defaults to http://localhost:3000 for the app URL.
 */

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const ORACLE_SECRET = process.env.ORACLE_SECRET ?? "";
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function writeSnapshot() {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] Writing oracle snapshot...`);

  try {
    const res = await fetch(`${APP_URL}/api/oracle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ORACLE_SECRET ? { "x-oracle-secret": ORACLE_SECRET } : {}),
      },
    });

    const data = await res.json();

    if (data.success) {
      console.log(
        `[${ts}] ✓ Snapshot #${data.snapshotId} written — tx ${data.txHash.slice(0, 16)}… block ${data.blockNumber}`
      );
      console.log(
        `       health=${data.snapshot.ecosystemHealth} minitias=${data.snapshot.activeMinitias} ibc=${data.snapshot.ibcChannels}`
      );
    } else {
      console.error(`[${ts}] ✗ Write failed:`, data.error);
    }
  } catch (err) {
    console.error(`[${ts}] ✗ Network error:`, err instanceof Error ? err.message : err);
  }
}

// Run immediately, then every 5 minutes
writeSnapshot();
setInterval(writeSnapshot, INTERVAL_MS);

console.log(`Oracle cron started — writing every ${INTERVAL_MS / 60000}min to ${APP_URL}`);
