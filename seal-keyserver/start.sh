#!/bin/bash
set -e

echo ""
echo "========================================================================"
echo "🔐 SEAL Key Server"
echo "========================================================================"
echo ""

# Validate ObjectID format (0x followed by 64 hex chars)
validate_object_id() {
  local id="$1"
  if [[ ! "$id" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
    echo "❌ Error: Invalid ObjectID format: $id"
    echo "   Expected: 0x followed by 64 hexadecimal characters"
    return 1
  fi
  return 0
}

# Check if MASTER_KEY is already set
if [ -z "${MASTER_KEY:-}" ]; then
  # Setup mode: Generate new keys
  echo "📝 Generating new master seed..."
  MASTER_KEY_RAW=$(/opt/key-server/bin/seal-cli gen-seed)
  GENERATED_MASTER_KEY=$(echo "$MASTER_KEY_RAW" | grep -oP "0x[a-f0-9]+" || echo "$MASTER_KEY_RAW")

  echo "✅ Master seed generated"
  echo ""
  echo "========================================================================"
  echo "🎉 MASTER KEY GENERATED"
  echo "========================================================================"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 MASTER_KEY (save this securely):"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "$GENERATED_MASTER_KEY"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📝 Next steps:"
  echo ""
  echo "1. Save the MASTER_KEY to your environment variables or secrets manager"
  echo "2. Redeploy with MASTER_KEY set (will output PUBLIC_KEY in logs)"
  echo "3. Register the PUBLIC_KEY on-chain"
  echo "4. Set KEY_SERVER_OBJECT_ID and redeploy for production"
  echo ""
  echo "========================================================================"
  echo ""
  echo "⚠️  Exiting - please save MASTER_KEY and redeploy"
  echo ""
  sleep 10
  exit 0
fi

# Production mode: MASTER_KEY is set
echo "✅ Using existing MASTER_KEY"
CLEAN_MASTER_KEY=$(echo -n "${MASTER_KEY}" | tr -d "\n\r")

# Check if we have KEY_SERVER_OBJECT_ID
if [ -z "$KEY_SERVER_OBJECT_ID" ] || [ "$KEY_SERVER_OBJECT_ID" = "" ]; then
  echo "⚠️  KEY_SERVER_OBJECT_ID not set - deriving PUBLIC_KEY"
  echo ""

  # Use seal-cli to derive the public key directly
  echo "📝 Deriving public key from MASTER_KEY..."
  PUBLIC_KEY=$(/opt/key-server/bin/seal-cli derived-public-key --index 0 2>&1 || true)

  # Extract just the public key from output
  PUBLIC_KEY_CLEAN=$(echo "$PUBLIC_KEY" | grep -oP "0x[a-f0-9]+" | head -1 || echo "$PUBLIC_KEY")

  echo ""
  echo "========================================================================"
  echo "🎉 PUBLIC KEY DERIVED"
  echo "========================================================================"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 PUBLIC_KEY (use this to register on-chain):"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "$PUBLIC_KEY_CLEAN"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📝 Next steps:"
  echo ""
  echo "1. Register this public key on-chain:"
  echo ""
  echo "   sui client call \\"
  echo "     --package 0xa212c4c6c7183b911d0be8768f4cb1df7a383025b5d0ba0c014009f0f30f5f8d \\"
  echo "     --module key_server \\"
  echo "     --function create_and_transfer_v1 \\"
  echo "     --args $PUBLIC_KEY_CLEAN <YOUR_ADDRESS> \\"
  echo "     --gas-budget 100000000"
  echo ""
  echo "2. Set KEY_SERVER_OBJECT_ID from the transaction and redeploy"
  echo ""
  echo "========================================================================"
  echo ""
  echo "⚠️  Exiting - please register PUBLIC_KEY and set KEY_SERVER_OBJECT_ID"
  echo ""
  sleep 10
  exit 0
fi

# Validate KEY_SERVER_OBJECT_ID format
CLEAN_KEY_SERVER_ID=$(echo -n "${KEY_SERVER_OBJECT_ID}" | tr -d "\n\r")
if ! validate_object_id "$CLEAN_KEY_SERVER_ID"; then
  echo ""
  echo "Please check your KEY_SERVER_OBJECT_ID environment variable"
  exit 1
fi

# Production mode: Both MASTER_KEY and KEY_SERVER_OBJECT_ID are set
echo "📝 Generating production config with:"
echo "   Key Server Object ID: ${CLEAN_KEY_SERVER_ID}"
echo ""

# Replace placeholders in the Permissioned template
sed "s|0x0000000000000000000000000000000000000000000000000000000000000000|${CLEAN_KEY_SERVER_ID}|g" \
  /app/config/template.yaml > /app/config/key-server-config.yaml

echo "✅ Config generated at /app/config/key-server-config.yaml"
echo ""
echo "🚀 Starting key server..."
echo ""

export CONFIG_PATH=/app/config/key-server-config.yaml
export MASTER_KEY="${CLEAN_MASTER_KEY}"
exec /opt/key-server/bin/key-server
