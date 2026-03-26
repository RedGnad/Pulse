/**
 * Oracle Cron — appelle POST /api/oracle toutes les 5 minutes
 * Lance avec: node scripts/oracle-cron.mjs
 * (garde ce processus en vie en parallèle du serveur Next.js)
 */

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const API_URL = process.env.ORACLE_API_URL ?? "http://localhost:3000/api/oracle";
const SECRET  = process.env.ORACLE_SECRET ?? "";

async function writeSnapshot() {
  const ts = new Date().toLocaleTimeString();
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SECRET ? { "x-oracle-secret": SECRET } : {}),
      },
    });
    const json = await res.json();
    if (json.success) {
      console.log(`[${ts}] ✓ Snapshot #${json.snapshotId} written — tx ${json.txHash?.slice(0, 14)}… health=${json.snapshot?.ecosystemHealth}`);
    } else {
      console.error(`[${ts}] ✗ Oracle error:`, json.error);
    }
  } catch (err) {
    console.error(`[${ts}] ✗ Fetch failed:`, err.message);
  }
}

console.log(`PulseOracle cron started — writing every 5 min to ${API_URL}`);
writeSnapshot(); // immediate first write
setInterval(writeSnapshot, INTERVAL_MS);
