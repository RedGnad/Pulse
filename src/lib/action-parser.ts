/**
 * Action intent parser for Ask Pulse — detects send/stake/bridge intents
 * from natural language and returns structured action data.
 */

export type ActionType = "send" | "stake" | "bridge";

export interface ActionIntent {
  type: ActionType;
  chainId: string;
  label: string;
  description: string;
  params: {
    amount?: string;
    recipient?: string;
    validator?: string;
    validatorName?: string;
  };
}

/**
 * Parse a user message for actionable intents.
 * Returns null if no action detected.
 */
export function parseActionIntent(
  message: string,
  validators?: { moniker: string; operator_address: string }[]
): ActionIntent | null {
  const msg = message.trim();

  // Send: "send 10 INIT to init1abc..."
  const sendMatch = msg.match(
    /(?:send|transfer|envoie|envoyer)\s+([\d.]+)\s*(?:init)?\s*(?:to|à|vers|→)\s*(init1[a-z0-9]{3,})/i
  );
  if (sendMatch) {
    const [, amount, recipient] = sendMatch;
    return {
      type: "send",
      chainId: "initiation-2",
      label: `Send ${amount} INIT`,
      description: `Transfer ${amount} INIT to ${recipient.slice(0, 12)}...${recipient.slice(-4)}`,
      params: { amount, recipient },
    };
  }

  // Stake: "stake 10 INIT on/with Maestro" or "delegate 10 INIT to initvaloper1..."
  const stakeMatch = msg.match(
    /(?:stake|delegate|staker|déléguer)\s+([\d.]+)\s*(?:init)?\s*(?:on|with|to|sur|avec|à)\s+(.+)/i
  );
  if (stakeMatch) {
    const [, amount, target] = stakeMatch;
    const trimmed = target.trim().replace(/[.!?]+$/, "");

    if (trimmed.startsWith("initvaloper")) {
      return {
        type: "stake",
        chainId: "initiation-2",
        label: `Stake ${amount} INIT`,
        description: `Delegate ${amount} INIT to ${trimmed.slice(0, 20)}...`,
        params: { amount, validator: trimmed },
      };
    }

    // Resolve validator by name
    if (validators?.length) {
      const val = validators.find(
        (v) => v.moniker.toLowerCase() === trimmed.toLowerCase()
      ) ?? validators.find(
        (v) => v.moniker.toLowerCase().includes(trimmed.toLowerCase())
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

    return {
      type: "stake",
      chainId: "initiation-2",
      label: `Stake ${amount} INIT`,
      description: `Delegate ${amount} INIT (validator "${trimmed}" — will resolve on-chain)`,
      params: { amount, validatorName: trimmed },
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
