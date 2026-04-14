import { describe, it, expect } from "vitest";
import { computePulseScore, computeAllPulseScores, scoreColor, scoreLabel } from "../pulse-score";
import type { MinitiaWithMetrics, IbcChannel } from "../types";

function makeMinitia(overrides: Partial<MinitiaWithMetrics["metrics"]> & { chainId?: string } = {}): MinitiaWithMetrics {
  const { chainId = "test-chain-1", ...metricsOverrides } = overrides;
  return {
    chainId,
    name: "Test Minitia",
    vmType: "evm",
    metrics: {
      blockHeight: 1000,
      totalTxCount: 500,
      activeValidators: 3,
      latestBlockTime: new Date().toISOString(),
      avgBlockTime: 2,
      lastBlockTxCount: 5,
      lastBlockGasUsed: 100000,
      lastBlockGasWanted: 200000,
      totalSupply: [{ denom: "uinit", amount: "1000000" }],
      ...metricsOverrides,
    },
  } as MinitiaWithMetrics;
}

function makeIbcChannel(sourceChainId: string, destChainId: string): IbcChannel {
  return {
    channelId: "channel-0",
    portId: "transfer",
    sourceChainId,
    destChainId,
    state: "STATE_OPEN",
  } as IbcChannel;
}

describe("computePulseScore", () => {
  it("returns zero scores for minitia with no metrics", () => {
    const m = makeMinitia({ blockHeight: 0 });
    const result = computePulseScore(m, [m]);
    expect(result.total).toBe(0);
    expect(result.activity).toBe(0);
    expect(result.settlement).toBe(0);
  });

  it("returns non-zero scores for healthy minitia", () => {
    const m = makeMinitia();
    const result = computePulseScore(m, [m]);
    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it("activity score is higher for more transactions", () => {
    const low = makeMinitia({ totalTxCount: 10 });
    const high = makeMinitia({ totalTxCount: 10000 });
    const all = [low, high];
    const scoreLow = computePulseScore(low, all);
    const scoreHigh = computePulseScore(high, all);
    expect(scoreHigh.activity).toBeGreaterThan(scoreLow.activity);
  });

  it("settlement score rewards L1 anchoring (OPinit bridge + IBC to Initia L1)", () => {
    const anchored = { ...makeMinitia({ chainId: "anchored-1" }), bridgeId: 42 } as MinitiaWithMetrics;
    const orphan = makeMinitia({ chainId: "orphan-1" });
    const channels = [makeIbcChannel(anchored.chainId, "initiation-2")];
    const scoreAnchored = computePulseScore(anchored, [anchored], channels);
    const scoreOrphan = computePulseScore(orphan, [orphan], []);
    expect(scoreAnchored.settlement).toBeGreaterThan(scoreOrphan.settlement);
    expect(scoreAnchored.settlement).toBeGreaterThanOrEqual(100);
  });

  it("bridge score is higher with bridge + IBC channels", () => {
    const withBridge = { ...makeMinitia(), bridgeId: 1234 } as MinitiaWithMetrics;
    const withoutBridge = makeMinitia();
    const channels = [makeIbcChannel(withBridge.chainId, "other-chain")];

    const scoreBridged = computePulseScore(withBridge, [withBridge], channels);
    const scoreNoBridge = computePulseScore(withoutBridge, [withoutBridge], []);
    expect(scoreBridged.bridge).toBeGreaterThan(scoreNoBridge.bridge);
  });

  it("uptime is high for fresh blocks", () => {
    const fresh = makeMinitia({ latestBlockTime: new Date().toISOString() });
    const result = computePulseScore(fresh, [fresh]);
    expect(result.uptime).toBeGreaterThanOrEqual(90);
  });

  it("uptime is low for stale blocks", () => {
    const stale = makeMinitia({
      latestBlockTime: new Date(Date.now() - 7200_000).toISOString()
    });
    const result = computePulseScore(stale, [stale]);
    expect(result.uptime).toBeLessThanOrEqual(50);
  });

  it("growth is higher when recent activity exceeds average", () => {
    const growing = makeMinitia({
      blockHeight: 100, totalTxCount: 100, lastBlockTxCount: 10
    });
    const flat = makeMinitia({
      blockHeight: 100, totalTxCount: 100, lastBlockTxCount: 0
    });
    expect(computePulseScore(growing, [growing]).growth)
      .toBeGreaterThan(computePulseScore(flat, [flat]).growth);
  });

  it("total score is weighted sum capped at 100", () => {
    const m = makeMinitia();
    const result = computePulseScore(m, [m]);
    expect(result.total).toBeLessThanOrEqual(100);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("all sub-scores are 0-100", () => {
    const m = makeMinitia();
    const result = computePulseScore(m, [m]);
    for (const key of ["activity", "settlement", "bridge", "growth", "uptime"] as const) {
      expect(result[key]).toBeGreaterThanOrEqual(0);
      expect(result[key]).toBeLessThanOrEqual(100);
    }
  });
});

describe("computeAllPulseScores", () => {
  it("returns scores for all minitias", () => {
    const m1 = makeMinitia({ chainId: "chain-a" });
    const m2 = makeMinitia({ chainId: "chain-b" });
    const scores = computeAllPulseScores([m1, m2]);
    expect(scores.size).toBe(2);
    expect(scores.has("chain-a")).toBe(true);
    expect(scores.has("chain-b")).toBe(true);
  });

  it("returns empty map for empty input", () => {
    const scores = computeAllPulseScores([]);
    expect(scores.size).toBe(0);
  });
});

describe("scoreColor", () => {
  it("returns green for healthy scores", () => {
    expect(scoreColor(80)).toBe("#00FF88");
  });

  it("returns cyan for decent scores", () => {
    expect(scoreColor(60)).toBe("#00D4FF");
  });

  it("returns amber for weak scores", () => {
    expect(scoreColor(30)).toBe("#FFB800");
  });

  it("returns red for critical scores", () => {
    expect(scoreColor(10)).toBe("#FF3366");
  });
});

describe("scoreLabel", () => {
  it("maps score ranges to labels", () => {
    expect(scoreLabel(80)).toBe("HEALTHY");
    expect(scoreLabel(60)).toBe("ACTIVE");
    expect(scoreLabel(30)).toBe("WEAK");
    expect(scoreLabel(10)).toBe("CRITICAL");
  });
});
