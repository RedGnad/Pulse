import { describe, it, expect } from "vitest";
import { parseActionIntent, parseActionIntents } from "../action-parser";

const VALIDATORS = [
  { moniker: "Chorus One", operator_address: "initvaloper1jydu9uz5ajav8alecjqu2y2gx36trchmcgqjyr" },
  { moniker: "Maestro", operator_address: "initvaloper1abc123def456ghi789jkl012mno345pqr678stu" },
];

describe("parseActionIntent", () => {
  describe("send", () => {
    it("parses send with full address", () => {
      const r = parseActionIntent("send 10 INIT to init18wahzdxxcaz36d53060alequs747ydfrej6mdm");
      expect(r).not.toBeNull();
      expect(r!.type).toBe("send");
      expect(r!.params.amount).toBe("10");
      expect(r!.params.recipient).toBe("init18wahzdxxcaz36d53060alequs747ydfrej6mdm");
    });

    it("parses send with .init username", () => {
      const r = parseActionIntent("send 5 INIT to alice.init");
      expect(r).not.toBeNull();
      expect(r!.type).toBe("send");
      expect(r!.params.amount).toBe("5");
      expect(r!.params.recipientUsername).toBe("alice");
      expect(r!.params.recipient).toBeUndefined();
    });

    it("parses send with @username", () => {
      const r = parseActionIntent("send 0.5 INIT to @bob");
      expect(r).not.toBeNull();
      expect(r!.params.recipientUsername).toBe("bob");
    });

    it("parses french send", () => {
      const r = parseActionIntent("envoie 10 INIT à @alice");
      expect(r).not.toBeNull();
      expect(r!.type).toBe("send");
      expect(r!.params.recipientUsername).toBe("alice");
    });

    it("rejects invalid address", () => {
      const r = parseActionIntent("send 10 INIT to init1short");
      expect(r).toBeNull();
    });

    it("parses decimal amount", () => {
      const r = parseActionIntent("send 0.001 INIT to @alice");
      expect(r).not.toBeNull();
      expect(r!.params.amount).toBe("0.001");
    });
  });

  describe("stake", () => {
    it("parses stake with validator name", () => {
      const r = parseActionIntent("stake 50 INIT on Chorus One", VALIDATORS);
      expect(r).not.toBeNull();
      expect(r!.type).toBe("stake");
      expect(r!.params.amount).toBe("50");
      expect(r!.params.validatorName).toBe("Chorus One");
      expect(r!.params.validator).toBe(VALIDATORS[0].operator_address);
    });

    it("parses stake with valoper address", () => {
      const r = parseActionIntent("delegate 100 INIT to initvaloper1jydu9uz5ajav8alecjqu2y2gx36trchmcgqjyr");
      expect(r).not.toBeNull();
      expect(r!.type).toBe("stake");
      expect(r!.params.validator).toBe("initvaloper1jydu9uz5ajav8alecjqu2y2gx36trchmcgqjyr");
    });

    it("parses partial validator name match", () => {
      const r = parseActionIntent("stake 10 INIT on chorus", VALIDATORS);
      expect(r).not.toBeNull();
      expect(r!.params.validatorName).toBe("Chorus One");
    });

    it("returns null for unknown validator without address", () => {
      const r = parseActionIntent("stake 10 INIT on UnknownVal", VALIDATORS);
      expect(r).toBeNull();
    });
  });

  describe("unstake", () => {
    it("parses unstake with validator name", () => {
      const r = parseActionIntent("unstake 20 INIT from Maestro", VALIDATORS);
      expect(r).not.toBeNull();
      expect(r!.type).toBe("unstake");
      expect(r!.params.amount).toBe("20");
      expect(r!.params.validatorName).toBe("Maestro");
    });

    it("parses french unstake", () => {
      const r = parseActionIntent("retirer 10 INIT de Chorus One", VALIDATORS);
      expect(r).not.toBeNull();
      expect(r!.type).toBe("unstake");
    });
  });

  describe("vote", () => {
    it("parses vote yes", () => {
      const r = parseActionIntent("vote yes on proposal 42");
      expect(r).not.toBeNull();
      expect(r!.type).toBe("vote");
      expect(r!.params.proposalId).toBe("42");
      expect(r!.params.voteOption).toBe(1);
    });

    it("parses vote no", () => {
      const r = parseActionIntent("vote no on proposal 15");
      expect(r).not.toBeNull();
      expect(r!.params.voteOption).toBe(3);
    });

    it("parses vote abstain", () => {
      const r = parseActionIntent("vote abstain on proposal 7");
      expect(r).not.toBeNull();
      expect(r!.params.voteOption).toBe(2);
    });

    it("parses french vote", () => {
      const r = parseActionIntent("voter oui sur proposition 42");
      expect(r).not.toBeNull();
      expect(r!.params.voteOption).toBe(1);
      expect(r!.params.proposalId).toBe("42");
    });

    it("parses vote veto", () => {
      const r = parseActionIntent("vote veto on proposal 3");
      expect(r).not.toBeNull();
      expect(r!.params.voteOption).toBe(4);
    });
  });

  describe("bridge", () => {
    it("parses bridge", () => {
      const r = parseActionIntent("bridge 10 INIT");
      expect(r).not.toBeNull();
      expect(r!.type).toBe("bridge");
      expect(r!.params.amount).toBe("10");
    });

    it("parses french bridge", () => {
      const r = parseActionIntent("transférer 5 INIT");
      expect(r).not.toBeNull();
      expect(r!.type).toBe("bridge");
    });
  });

  describe("no match", () => {
    it("returns null for general questions", () => {
      expect(parseActionIntent("What is the ecosystem health?")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseActionIntent("")).toBeNull();
    });
  });
});

describe("parseActionIntents (multi-action)", () => {
  it("parses two actions with 'then'", () => {
    const r = parseActionIntents("send 5 INIT to @alice then stake 10 INIT on Chorus One", VALIDATORS);
    expect(r).toHaveLength(2);
    expect(r[0].type).toBe("send");
    expect(r[1].type).toBe("stake");
  });

  it("parses actions with 'puis' (french)", () => {
    const r = parseActionIntents("envoie 1 INIT à @bob puis bridge 5 INIT", VALIDATORS);
    expect(r).toHaveLength(2);
    expect(r[0].type).toBe("send");
    expect(r[1].type).toBe("bridge");
  });

  it("returns single action for non-compound message", () => {
    const r = parseActionIntents("send 10 INIT to @alice");
    expect(r).toHaveLength(1);
  });

  it("skips invalid segments in compound message", () => {
    const r = parseActionIntents("send 5 INIT to @alice then how is the ecosystem");
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe("send");
  });

  it("returns empty for non-action message", () => {
    const r = parseActionIntents("What validators are active?");
    expect(r).toHaveLength(0);
  });
});
