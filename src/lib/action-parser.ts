/**
 * Action intent parser for Ask Pulse — detects send/stake/unstake/bridge intents
 * from natural language and returns structured action data.
 */

export type ActionType = "send" | "stake" | "unstake" | "bridge" | "vote";

export interface ActionIntent {
  type: ActionType;
  chainId: string;
  label: string;
  description: string;
  params: {
    amount?: string;
    recipient?: string;
    recipientUsername?: string;
    validator?: string;
    validatorName?: string;
    proposalId?: string;
    voteOption?: number; // 1=YES, 2=ABSTAIN, 3=NO, 4=VETO
  };
}

/** Initia bech32 address: init1 + 38 alphanumeric chars */
const VALID_INITIA_ADDR = /^init1[a-z0-9]{38}$/;
const VALID_VALOPER_ADDR = /^initvaloper1[a-z0-9]{38}$/;

/**
 * Parse a user message for actionable intents.
 * Only returns an action if all parameters are valid — never shows
 * an executable card for malformed addresses.
 */
export function parseActionIntent(
  message: string,
  validators?: { moniker: string; operator_address: string }[]
): ActionIntent | null {
  const msg = message.trim();

  // Send: "send 10 INIT to init1abc..." or "send 10 INIT to @alice" / "send 10 INIT to alice.init"
  const sendMatch = msg.match(
    /(?:send|transfer|envoie|envoyer)\s+([\d.]+)\s*(?:init)?\s*(?:to|à|a|vers|→)\s*(.+)/i
  );
  if (sendMatch) {
    const [, amount, rawTarget] = sendMatch;
    const target = rawTarget.trim().replace(/[.!?]+$/, "");

    // Direct address
    if (target.startsWith("init1")) {
      if (!VALID_INITIA_ADDR.test(target)) return null;
      return {
        type: "send",
        chainId: "initiation-2",
        label: `Send ${amount} INIT`,
        description: `Transfer ${amount} INIT to ${target.slice(0, 12)}...${target.slice(-4)}`,
        params: { amount, recipient: target },
      };
    }

    // Username: @alice or alice.init
    const usernameMatch = target.match(/^@?([a-z0-9_-]+)(?:\.init)?$/i);
    if (usernameMatch) {
      const name = usernameMatch[1].toLowerCase();
      return {
        type: "send",
        chainId: "initiation-2",
        label: `Send ${amount} INIT`,
        description: `Transfer ${amount} INIT to @${name}.init`,
        params: { amount, recipientUsername: name },
      };
    }

    return null;
  }

  // Unstake: "unstake 10 INIT from Chorus One" or "undelegate 10 INIT from initvaloper1..."
  const unstakeMatch = msg.match(
    /(?:unstake|undelegate|undéléguer|retirer)\s+([\d.]+)\s*(?:init)?\s*(?:from|de|depuis)\s+(.+)/i
  );
  if (unstakeMatch) {
    const [, amount, target] = unstakeMatch;
    const trimmed = target.trim().replace(/[.!?]+$/, "");

    if (trimmed.startsWith("initvaloper")) {
      if (!VALID_VALOPER_ADDR.test(trimmed)) return null;
      return {
        type: "unstake",
        chainId: "initiation-2",
        label: `Unstake ${amount} INIT`,
        description: `Undelegate ${amount} INIT from ${trimmed.slice(0, 20)}...`,
        params: { amount, validator: trimmed },
      };
    }

    if (validators?.length) {
      const lower = trimmed.toLowerCase();
      const val = validators.find(
        (v) => v.moniker.toLowerCase() === lower
      ) ?? validators.find(
        (v) => v.moniker.toLowerCase().includes(lower) || lower.includes(v.moniker.toLowerCase())
      );
      if (val) {
        return {
          type: "unstake",
          chainId: "initiation-2",
          label: `Unstake ${amount} INIT`,
          description: `Undelegate ${amount} INIT from ${val.moniker}`,
          params: { amount, validator: val.operator_address, validatorName: val.moniker },
        };
      }
    }

    return null;
  }

  // Stake: "stake 10 INIT on/with Maestro" or "delegate 10 INIT to initvaloper1..."
  const stakeMatch = msg.match(
    /(?:stake|delegate|staker|déléguer)\s+([\d.]+)\s*(?:init)?\s*(?:on|with|to|sur|avec|à)\s+(.+)/i
  );
  if (stakeMatch) {
    const [, amount, target] = stakeMatch;
    const trimmed = target.trim().replace(/[.!?]+$/, "");

    if (trimmed.startsWith("initvaloper")) {
      if (!VALID_VALOPER_ADDR.test(trimmed)) return null;
      return {
        type: "stake",
        chainId: "initiation-2",
        label: `Stake ${amount} INIT`,
        description: `Delegate ${amount} INIT to ${trimmed.slice(0, 20)}...`,
        params: { amount, validator: trimmed },
      };
    }

    if (validators?.length) {
      const lower = trimmed.toLowerCase();
      const val = validators.find(
        (v) => v.moniker.toLowerCase() === lower
      ) ?? validators.find(
        (v) => v.moniker.toLowerCase().includes(lower) || lower.includes(v.moniker.toLowerCase())
      );
      if (val) {
        return {
          type: "stake",
          chainId: "initiation-2",
          label: `Stake ${amount} INIT`,
          description: `Delegate ${amount} INIT to ${val.moniker}`,
          params: { amount, validator: val.operator_address, validatorName: val.moniker },
        };
      }
    }

    return null;
  }

  // Vote: "vote yes on proposal 42" / "vote no on 15" / "voter oui sur la proposition 42"
  const voteMatch = msg.match(
    /(?:vote|voter)\s+(yes|no|abstain|veto|oui|non)\s+(?:on|sur|for|pour)\s+(?:proposal\s*|proposition\s*|prop\s*|#)?(\d+)/i
  );
  if (voteMatch) {
    const [, rawOption, proposalId] = voteMatch;
    const optionMap: Record<string, number> = {
      yes: 1, oui: 1, abstain: 2, no: 3, non: 3, veto: 4,
    };
    const voteOption = optionMap[rawOption.toLowerCase()] ?? 1;
    const optionLabel = ["", "Yes", "Abstain", "No", "Veto"][voteOption];
    return {
      type: "vote",
      chainId: "initia-pulse-1",
      label: `Vote ${optionLabel} on Proposal #${proposalId}`,
      description: `Vote ${optionLabel} on Initia L1 governance proposal #${proposalId} via PulseGov (ICosmos precompile)`,
      params: { proposalId, voteOption },
    };
  }

  // Bridge: "bridge 10 INIT to pulse" / "bridge 5 INIT"
  const bridgeMatch = msg.match(
    /(?:bridge|pont|transférer)\s+([\d.]+)\s*(?:init)?/i
  );
  if (bridgeMatch) {
    const [, amount] = bridgeMatch;
    return {
      type: "bridge",
      chainId: "initiation-2",
      label: `Bridge ${amount} INIT`,
      description: `Bridge ${amount} INIT from L1 to Pulse rollup via Interwoven Bridge`,
      params: { amount },
    };
  }

  return null;
}

/**
 * Parse a message for multiple sequential action intents.
 * Splits on "then", "and then", "puis", "ensuite", "after that".
 * Returns an array of valid actions (empty if none found).
 */
export function parseActionIntents(
  message: string,
  validators?: { moniker: string; operator_address: string }[]
): ActionIntent[] {
  const segments = message
    .split(/\b(?:then|and then|after that|puis|ensuite|et ensuite|après)\b/i)
    .map(s => s.trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    const single = parseActionIntent(message, validators);
    return single ? [single] : [];
  }

  const actions: ActionIntent[] = [];
  for (const segment of segments) {
    const action = parseActionIntent(segment, validators);
    if (action) actions.push(action);
  }
  return actions;
}
