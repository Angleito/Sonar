#!/bin/bash
# Create a single test submission on Sui testnet for voting system testing
#
# Usage: ./scripts/create-test-submission.sh "Title" blob_id seal_policy duration_seconds

set -e

PACKAGE_ID="${NEXT_PUBLIC_PACKAGE_ID:-0x300b8182eea252a00d5ff19568126cc20c0bdd19c7e25f6c6953363393d344e6}"
MARKETPLACE_ID="${NEXT_PUBLIC_MARKETPLACE_ID:-0xaa422269e77e2197188f9c8e47ffb3faf21c0bafff1d5d04ea9613acc4994bb4}"
UPLOAD_FEE="1000000000"  # 1 SUI expressed in MIST (10^-9 SUI)

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

# Build and execute transaction
# Note: For Option<vector<u8>>, we need to split the gas coin for the upload fee first
sui client ptb \
    --split-gas "[${UPLOAD_FEE}]" \
    --assign upload_fee \
    --move-call "$PACKAGE_ID::marketplace::submit_audio" "$MARKETPLACE_ID" upload_fee "\"$BLOB_ID\"" "\"$SEAL_POLICY\"" "none" "$DURATION" \
    --gas-budget 100000000

echo ""
echo "✅ Submission created! Check https://suiscan.xyz/testnet for details"
