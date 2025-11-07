#!/bin/bash
# Create a single test submission on Sui testnet for voting system testing
#
# Usage: ./scripts/create-test-submission.sh "Title" blob_id seal_policy duration_seconds

set -e

PACKAGE_ID="${NEXT_PUBLIC_PACKAGE_ID:-0x300b8182eea252a00d5ff19568126cc20c0bdd19c7e25f6c6953363393d344e6}"
MARKETPLACE_ID="${NEXT_PUBLIC_MARKETPLACE_ID:-0xaa422269e77e2197188f9c8e47ffb3faf21c0bafff1d5d04ea9613acc4994bb4}"
BURN_FEE="1000000"  # 0.001 SONAR

TITLE="${1:-Test Audio Submission}"
BLOB_ID="${2:-test_blob_$(date +%s)}"
SEAL_POLICY="${3:-test_policy_$(date +%s)}"
DURATION="${4:-180}"

echo "🚀 Creating test submission on Sui testnet..."
echo ""
echo "📦 Package: $PACKAGE_ID"
echo "🏪 Marketplace: $MARKETPLACE_ID"
echo "📝 Title: $TITLE"
echo "🔗 Blob ID: $BLOB_ID"
echo "🔐 Seal Policy: $SEAL_POLICY"
echo "⏱️  Duration: ${DURATION}s"
echo ""

# Get a SONAR coin
SONAR_COIN=$(sui client objects --json | jq -r '.[] | select(.data.type | contains("SONAR_TOKEN")) | .data.objectId' | head -1)

if [ -z "$SONAR_COIN" ]; then
    echo "❌ No SONAR tokens found"
    exit 1
fi

echo "💎 Using SONAR coin: $SONAR_COIN"
echo ""

# Build and execute transaction
# Note: For Option<vector<u8>>, we need to split the coin for burn fee first
sui client ptb \
    --assign burn_coin "@$SONAR_COIN" \
    --split-coins burn_coin "[1000000]" \
    --assign burn_split \
    --move-call "$PACKAGE_ID::marketplace::submit_audio" "$MARKETPLACE_ID" burn_split "\"$BLOB_ID\"" "\"$SEAL_POLICY\"" "none" "$DURATION" \
    --gas-budget 100000000

echo ""
echo "✅ Submission created! Check https://suiscan.xyz/testnet for details"
