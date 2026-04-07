#!/bin/bash
# Deploy PulseGate to the local MiniEVM rollup
# Usage: ./scripts/deploy-gate.sh
#
# Requires: forge (Foundry), DEPLOYER_PRIVATE_KEY env var
# PulseGate needs the PulseOracle address as constructor argument.

set -euo pipefail

RPC_URL="${PULSE_EVM_RPC:-http://127.0.0.1:8545}"
CHAIN_ID="${PULSE_EVM_CHAIN_ID:-2150269405855764}"
ORACLE_ADDR="${PULSE_ORACLE_ADDRESS:-}"

if [ -z "${DEPLOYER_PRIVATE_KEY:-}" ]; then
  echo "Error: DEPLOYER_PRIVATE_KEY not set"
  echo "Export it first: export DEPLOYER_PRIVATE_KEY=0x..."
  exit 1
fi

if [ -z "$ORACLE_ADDR" ]; then
  echo "Error: PULSE_ORACLE_ADDRESS not set"
  echo "PulseGate needs PulseOracle's address as constructor arg."
  echo "Export it first: export PULSE_ORACLE_ADDRESS=0x..."
  exit 1
fi

echo "Deploying PulseGate to $RPC_URL (chain $CHAIN_ID)..."
echo "  Oracle address: $ORACLE_ADDR"

RESULT=$(forge create contracts/PulseGate.sol:PulseGate \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --constructor-args "$ORACLE_ADDR" \
  --json 2>&1)

ADDR=$(echo "$RESULT" | jq -r '.deployedTo // empty')

if [ -z "$ADDR" ]; then
  echo "Deployment failed:"
  echo "$RESULT"
  exit 1
fi

echo ""
echo "PulseGate deployed at: $ADDR"
echo "  Linked to PulseOracle: $ORACLE_ADDR"
echo ""
echo "Done. Update README with this address."
