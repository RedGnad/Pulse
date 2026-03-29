#!/bin/bash
# Deploy PulseOracle to the local MiniEVM rollup
# Usage: ./scripts/deploy-oracle.sh
#
# Requires: forge (Foundry), DEPLOYER_PRIVATE_KEY env var
# The deployer becomes the contract owner.

set -euo pipefail

RPC_URL="${PULSE_EVM_RPC:-http://127.0.0.1:8545}"
CHAIN_ID="${PULSE_EVM_CHAIN_ID:-2150269405855764}"

if [ -z "${DEPLOYER_PRIVATE_KEY:-}" ]; then
  echo "Error: DEPLOYER_PRIVATE_KEY not set"
  echo "Export it first: export DEPLOYER_PRIVATE_KEY=0x..."
  exit 1
fi

echo "Deploying PulseOracle to $RPC_URL (chain $CHAIN_ID)..."

RESULT=$(forge create contracts/PulseOracle.sol:PulseOracle \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --json 2>&1)

ADDR=$(echo "$RESULT" | jq -r '.deployedTo // empty')

if [ -z "$ADDR" ]; then
  echo "Deployment failed:"
  echo "$RESULT"
  exit 1
fi

echo ""
echo "PulseOracle deployed at: $ADDR"
echo ""
echo "Update your .env.local:"
echo "  PULSE_ORACLE_ADDRESS=$ADDR"
echo ""
echo "Done."
