import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const OUT = "/tmp/pulse-smoke";
mkdirSync(OUT, { recursive: true });

const results = [];

function log(status, name, detail = "") {
  const icon = status === "pass" ? "✓" : status === "warn" ? "⚠" : "✗";
  console.log(`${icon} ${name}${detail ? "  — " + detail : ""}`);
  results.push({ status, name, detail });
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
});

async function goto(path, { waitFor = null } = {}) {
  errors.length = 0;
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 45000 });
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 15000 });
  return { status: res?.status() ?? 0, errors: [...errors] };
}

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

// ───── / (Act) ─────
try {
  const r = await goto("/");
  if (r.status !== 200) log("fail", "/ status", `${r.status}`);
  else {
    const h1 = (await page.locator("h1").first().textContent())?.trim() ?? "";
    const hasAskChips = await page.getByText(/borrow USDC|mint NFTs|stake INIT/i).first().isVisible().catch(() => false);
    const hasVerdict = await page.getByText(/Pulse Score|Intent|Reasoning/i).first().isVisible().catch(() => false);
    log("pass", "/ (Act) loads", `h1="${h1}"`);
    log(hasAskChips ? "pass" : "warn", "/ has demo query chips");
    log(hasVerdict ? "pass" : "warn", "/ renders verdict layout");
    if (r.errors.length) log("warn", "/ console errors", r.errors.slice(0, 2).join(" | "));
    await shot("01-home");
  }
} catch (e) { log("fail", "/", e.message); }

// ───── Click a demo query and check verdict appears ─────
try {
  // try to click the first demo chip/button
  const chip = page.locator("button, a").filter({ hasText: /borrow USDC|trade ETH|mint NFT|stake INIT|swap/i }).first();
  if (await chip.count() > 0) {
    await chip.click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    const hasExecute = await page.getByText(/Execute|Ask Pulse/i).first().isVisible().catch(() => false);
    log(hasExecute ? "pass" : "warn", "clicking demo query reveals Execute CTA");
    await shot("02-verdict");
  } else {
    log("warn", "no demo chip found to click");
  }
} catch (e) { log("warn", "demo-query flow", e.message); }

// ───── Fix #1: "trade ETH perps" must NOT show Initia L1 as top target ─────
try {
  await goto("/");
  // Ensure we're in a clean state: click "trade ETH perps with leverage" chip.
  const perpsChip = page.locator("button").filter({ hasText: /trade ETH perps/i }).first();
  if (await perpsChip.count() > 0) {
    await perpsChip.click();
    await page.waitForTimeout(2500);
    // The target list: first rollup card should be a DeFi rollup (Rave/Echelon),
    // NOT Initia L1. We check the first "target" card text.
    const firstTargetText = await page.locator("button").filter({ hasText: /HEALTHY|ACTIVE|STABLE|LOW|DEGRADED/i }).first().textContent().catch(() => "");
    const l1IsFirst = /Initia L1/i.test(firstTargetText ?? "");
    log(!l1IsFirst ? "pass" : "fail",
      "trade perps: L1 is NOT top target",
      l1IsFirst ? `first=${firstTargetText?.slice(0, 60)}` : `first=${firstTargetText?.slice(0, 60)}`);
    await shot("07-trade-perps-targets");
  } else {
    log("warn", "trade perps chip not found");
  }
} catch (e) { log("warn", "trade-perps routing", e.message); }

// ───── Fix #3A: click a trade target → dual CTA with "Open <app>" ─────
try {
  // Still on the perps verdict page; click the first rollup target
  const firstTarget = page.locator("button").filter({ hasText: /DeFi|NFT|Gaming/i }).first();
  if (await firstTarget.count() > 0) {
    await firstTarget.click();
    await page.waitForTimeout(1500);
    const hasOpenCta = await page.getByText(/Open .+→/i).first().isVisible().catch(() => false);
    const hasAskSecondary = await page.getByText(/Ask Pulse about|Execute via Ask/i).first().isVisible().catch(() => false);
    log(hasOpenCta ? "pass" : "warn", "verdict shows 'Open <app>' primary CTA");
    log(hasAskSecondary ? "pass" : "warn", "verdict shows Ask Pulse secondary CTA");
    await shot("08-verdict-dual-cta");
  }
} catch (e) { log("warn", "dual-CTA check", e.message); }

// ───── Fix #2: clicking a target scrolls the verdict into view ─────
try {
  const scrollY = await page.evaluate(() => window.scrollY);
  log(scrollY > 100 ? "pass" : "warn",
    "target selection scrolls page toward verdict",
    `scrollY=${scrollY}`);
} catch (e) { log("warn", "auto-scroll check", e.message); }

// ───── /proof ─────
try {
  const r = await goto("/proof");
  if (r.status !== 200) log("fail", "/proof status", `${r.status}`);
  else {
    const hasOracle = await page.getByText(/PulseOracle|Oracle/i).first().isVisible().catch(() => false);
    log("pass", "/proof loads");
    log(hasOracle ? "pass" : "warn", "/proof mentions Oracle");
    if (r.errors.length) log("warn", "/proof console errors", r.errors.slice(0, 2).join(" | "));
    await shot("03-proof");
  }
} catch (e) { log("fail", "/proof", e.message); }

// ───── /ask ─────
try {
  const r = await goto("/ask");
  if (r.status !== 200) log("fail", "/ask status", `${r.status}`);
  else {
    const hasTextarea = await page.locator("textarea").first().isVisible().catch(() => false);
    log("pass", "/ask loads");
    log(hasTextarea ? "pass" : "warn", "/ask has input textarea");
    if (r.errors.length) log("warn", "/ask console errors", r.errors.slice(0, 2).join(" | "));
    await shot("04-ask");
  }
} catch (e) { log("fail", "/ask", e.message); }

// ───── /ask?prompt=... deep-link auto-send ─────
try {
  const r = await goto("/ask?prompt=where%20should%20I%20stake%20INIT");
  if (r.status !== 200) log("fail", "/ask?prompt= status", `${r.status}`);
  else {
    // give auto-send a moment
    await page.waitForTimeout(2500);
    const textareaVal = await page.locator("textarea").first().inputValue().catch(() => "");
    const prefilled = textareaVal.toLowerCase().includes("stake");
    // after auto-send, textarea typically clears OR a user message bubble appears
    const hasChatMsg = await page.getByText(/where should I stake/i).first().isVisible().catch(() => false);
    log(prefilled || hasChatMsg ? "pass" : "warn", "/ask?prompt= deep-link honored",
      prefilled ? `prefill="${textareaVal.slice(0,40)}"` : hasChatMsg ? "auto-sent as chat msg" : "neither prefill nor chat msg visible");
    await shot("05-ask-deeplink");
  }
} catch (e) { log("fail", "/ask?prompt=", e.message); }

// ───── /map (should 404 with new copy) ─────
try {
  const r = await goto("/map");
  const body = (await page.locator("body").textContent())?.toLowerCase() ?? "";
  const has404Copy = body.includes("off the map") || body.includes("doesn't exist");
  const stillSaysSignal = body.includes("back to signal") || body.includes("head back to signal");
  log(has404Copy ? "pass" : "warn", "/map shows 404 page");
  log(!stillSaysSignal ? "pass" : "fail", "/map 404 no longer says 'Signal'");
  await shot("06-404");
} catch (e) { log("fail", "/map", e.message); }

// ───── Header nav order ─────
try {
  await goto("/");
  const navLinks = await page.locator("header a").allTextContents();
  const simplified = navLinks.map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  console.log("  nav:", simplified.slice(0, 10));
  const actIdx = simplified.findIndex(s => /act/i.test(s) && !/intera/i.test(s));
  const proofIdx = simplified.findIndex(s => /proof/i.test(s));
  const askIdx = simplified.findIndex(s => /ask/i.test(s));
  const correctOrder = actIdx >= 0 && proofIdx > actIdx && askIdx > proofIdx;
  log(correctOrder ? "pass" : "warn", "header nav order Act → Proof → Ask Pulse",
    `indices: Act=${actIdx}, Proof=${proofIdx}, Ask=${askIdx}`);
} catch (e) { log("warn", "nav-order check", e.message); }

await browser.close();

console.log("\n═════ SUMMARY ═════");
const fail = results.filter(r => r.status === "fail").length;
const warn = results.filter(r => r.status === "warn").length;
const pass = results.filter(r => r.status === "pass").length;
console.log(`${pass} pass, ${warn} warn, ${fail} fail`);
console.log(`screenshots → ${OUT}/`);
process.exit(fail > 0 ? 1 : 0);
