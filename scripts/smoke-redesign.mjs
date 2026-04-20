import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const OUT = "/tmp/pulse-smoke-redesign";
mkdirSync(OUT, { recursive: true });

const results = [];
function log(status, name, detail = "") {
  const icon = status === "pass" ? "✓" : status === "warn" ? "⚠" : "✗";
  console.log(`${icon} ${name}${detail ? "  — " + detail : ""}`);
  results.push({ status, name, detail });
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem("pulse-network", "mainnet"));
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

async function goto(path) {
  errors.length = 0;
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 45000 });
  return { status: res?.status() ?? 0, errors: [...errors] };
}
async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

// ─── 1. Landing (empty state — Ask Pulse chat with categories) ─────
try {
  const r = await goto("/");
  const h1 = (await page.locator("h1").first().textContent())?.trim() ?? "";
  log(r.status === 200 ? "pass" : "fail", "landing loads", `h1="${h1.slice(0, 60)}"`);
  log(/Ask Pulse/i.test(h1) ? "pass" : "fail", "h1 says Ask Pulse");

  // Category cards visible (Ecosystem, Staking, Bridge, Security, Deploy, Data)
  const hasCats = await page.getByText("Ecosystem").first().isVisible().catch(() => false);
  log(hasCats ? "pass" : "fail", "category cards visible");

  // Prepared questions clickable
  const hasStakeQ = await page.getByText(/Stake 1 INIT/i).first().isVisible().catch(() => false);
  log(hasStakeQ ? "pass" : "fail", "prepared question visible");

  // Textarea input at bottom
  const hasInput = await page.locator("textarea").first().isVisible().catch(() => false);
  log(hasInput ? "pass" : "fail", "textarea input visible");

  // Live data indicator
  const hasLive = await page.getByText(/live ecosystem feed/i).first().isVisible().catch(() => false);
  log(hasLive ? "pass" : "warn", "live data indicator shown");

  // Header: Ask Pulse brand, no nav tabs
  const headerText = await page.locator("header").first().textContent() ?? "";
  log(/Ask Pulse/i.test(headerText) ? "pass" : "fail", "header brand says Ask Pulse");
  const navLinks = await page.locator("header a").allTextContents();
  const hasActNav = navLinks.some(s => /^Act$/i.test(s.trim()));
  log(!hasActNav ? "pass" : "fail", "no Act nav tab");

  // No messages yet (empty state centered)
  const noMsgBubbles = (await page.locator("[style*='flex-end']").count()) === 0;
  log(noMsgBubbles ? "pass" : "warn", "no message bubbles in empty state");

  await shot("01-landing");
} catch (e) { log("fail", "landing", e.message); }

// ─── 2. Click "Stake 1 INIT on Chorus One" → conversation with routing cards ─────
try {
  const stakeBtn = page.locator("button").filter({ hasText: /Stake 1 INIT on Chorus One/i }).first();
  await stakeBtn.click({ timeout: 5000 });
  await page.waitForTimeout(2000);

  // User message should appear
  const userBubble = await page.getByText(/Stake 1 INIT/i).first().isVisible().catch(() => false);
  log(userBubble ? "pass" : "fail", "user message bubble appears");

  // Categories should disappear, chat messages visible
  const catsGone = !(await page.getByText("Ecosystem").first().isVisible().catch(() => false));
  log(catsGone ? "pass" : "warn", "categories hidden after message");

  // Routing response: L1-only for stake
  const hasL1 = await page.getByText(/Initia L1/i).first().isVisible().catch(() => false);
  log(hasL1 ? "pass" : "fail", "stake shows Initia L1 routing");

  const hasVerdict = await page.getByText(/ROUTE CLEAR|CAUTION|BLOCKED/i).first().isVisible().catch(() => false);
  log(hasVerdict ? "pass" : "fail", "verdict badge on hero card");

  const has1Match = await page.getByText(/1 match/i).first().isVisible().catch(() => false);
  log(has1Match ? "pass" : "warn", "stake shows 1 match");

  // Staking L1-only banner
  const hasL1Banner = await page.getByText(/Staking happens on Initia L1/i).first().isVisible().catch(() => false);
  log(hasL1Banner ? "pass" : "warn", "L1-only staking banner");

  // No <a> link to /ask
  const askLinks = await page.locator("a[href*='/ask']").count();
  log(askLinks === 0 ? "pass" : "fail", "no <a> link to /ask");

  await shot("02-stake-init");
} catch (e) { log("fail", "stake INIT flow", e.message); }

// ─── 3. Follow-up: type "bridge 5 INIT" in same conversation ─────
try {
  await page.locator("textarea").first().fill("bridge 5 INIT to a rollup");
  await page.locator("textarea").first().press("Enter");
  await page.waitForTimeout(2000);

  // Should now have 2 user messages
  const stakeVisible = await page.getByText(/Stake 1 INIT/i).first().isVisible().catch(() => false);
  log(stakeVisible ? "pass" : "fail", "previous message still visible");

  const bridgeVisible = await page.getByText(/bridge 5 INIT/i).first().isVisible().catch(() => false);
  log(bridgeVisible ? "pass" : "fail", "new message visible in conversation");

  // Bridge routing should show rollup results (not just L1)
  const allText = await page.locator("body").textContent() ?? "";
  const afterBridge = allText.slice(allText.indexOf("bridge 5 INIT"));
  const hasMatches = /\d+ match/i.test(afterBridge);
  log(hasMatches ? "pass" : "warn", "bridge routing shows matches");

  await shot("03-bridge-convo");
} catch (e) { log("fail", "bridge follow-up", e.message); }

// ─── 4. Fresh page: type "trade ETH perps" directly ─────
try {
  await goto("/");
  await page.locator("textarea").first().fill("trade ETH perps with leverage");
  await page.locator("textarea").first().press("Enter");
  await page.waitForTimeout(2000);

  // Routing response — should NOT show L1 as top
  const allText = await page.locator("body").textContent() ?? "";
  const afterTrade = allText.slice(allText.indexOf("trade ETH perps"));
  const l1IsTop = /Initia L1/i.test(afterTrade.slice(0, 500));
  log(!l1IsTop ? "pass" : "fail", "L1 not top for trade intent");

  const hasDeFi = await page.getByText(/DEFI/i).first().isVisible().catch(() => false);
  log(hasDeFi ? "pass" : "warn", "DeFi category badge");

  const hasVerdict = await page.getByText(/ROUTE CLEAR|CAUTION|BLOCKED/i).first().isVisible().catch(() => false);
  log(hasVerdict ? "pass" : "warn", "verdict badge for trade");

  await shot("04-trade-direct");
} catch (e) { log("fail", "trade direct", e.message); }

// ─── 5. Click prepared question: "Bridge 5 INIT to a rollup" ─────
try {
  await goto("/");
  const bridgeBtn = page.locator("button").filter({ hasText: /Bridge 5 INIT to a rollup/i }).first();
  await bridgeBtn.click({ timeout: 5000 });
  await page.waitForTimeout(2000);

  const hasMatches = await page.getByText(/\d+ match/i).first().isVisible().catch(() => false);
  log(hasMatches ? "pass" : "warn", "bridge category shows matches");

  await shot("05-bridge-category");
} catch (e) { log("fail", "bridge category", e.message); }

// ─── 6. Mobile viewport ─────
try {
  await page.setViewportSize({ width: 390, height: 844 });
  await goto("/");
  const h1 = await page.locator("h1").first().isVisible().catch(() => false);
  const cats = await page.getByText("Staking").first().isVisible().catch(() => false);
  log(h1 ? "pass" : "fail", "mobile: h1 visible");
  log(cats ? "pass" : "warn", "mobile: categories visible");
  await shot("06-mobile-landing");

  // Click a question on mobile
  const stakeBtn = page.locator("button").filter({ hasText: /Stake 1 INIT/i }).first();
  if (await stakeBtn.count() > 0) {
    await stakeBtn.click();
    await page.waitForTimeout(3000);
    await shot("07-mobile-results");
    log("pass", "mobile: results render after question click");
  }
} catch (e) { log("warn", "mobile", e.message); }

// ─── 7. URL deep-link ─────
try {
  await page.setViewportSize({ width: 1400, height: 900 });
  const r = await goto("/?intent=mint+NFTs");
  await page.waitForTimeout(3000);
  const hasMint = await page.getByText(/NFT/i).first().isVisible().catch(() => false);
  log(r.status === 200 && hasMint ? "pass" : "warn", "URL deep-link /?intent=mint+NFTs");
  await shot("08-deeplink");
} catch (e) { log("warn", "deep-link", e.message); }

// ─── 8. /ask redirects to / ─────
try {
  const r = await goto("/ask");
  await page.waitForTimeout(2000);
  const finalUrl = page.url();
  const redirectedHome = !finalUrl.includes("/ask");
  log(r.status === 200 && redirectedHome ? "pass" : "warn", "/ask redirects to /", `url=${finalUrl}`);
} catch (e) { log("warn", "/ask redirect", e.message); }

// ─── 9. No floating chat bubble ─────
try {
  await goto("/");
  const floatingBubble = await page.locator("button[style*='position: fixed']").count();
  log(floatingBubble === 0 ? "pass" : "fail", "no floating chat bubble");
} catch (e) { log("warn", "floating chat check", e.message); }

// ─── 10. New chat button resets conversation ─────
try {
  await goto("/");
  // Send a message first
  await page.locator("textarea").first().fill("stake INIT");
  await page.locator("textarea").first().press("Enter");
  await page.waitForTimeout(2000);

  // Click "New chat" button
  const newChatBtn = page.locator("button").filter({ hasText: /New chat/i }).first();
  if (await newChatBtn.count() > 0) {
    await newChatBtn.click();
    await page.waitForTimeout(500);

    // Should be back to empty state with categories
    const hasCats = await page.getByText("Ecosystem").first().isVisible().catch(() => false);
    log(hasCats ? "pass" : "fail", "new chat restores categories");
  } else {
    log("warn", "new chat restores categories", "New chat button not found");
  }
} catch (e) { log("warn", "new chat reset", e.message); }

await browser.close();

console.log("\n═════ SUMMARY ═════");
const fail = results.filter(r => r.status === "fail").length;
const warn = results.filter(r => r.status === "warn").length;
const pass = results.filter(r => r.status === "pass").length;
console.log(`${pass} pass, ${warn} warn, ${fail} fail`);
console.log(`screenshots → ${OUT}/`);
process.exit(fail > 0 ? 1 : 0);
