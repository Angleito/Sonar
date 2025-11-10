#!/bin/bash
set -e

echo ""
echo "========================================================================"
echo "🔐 SONAR SEAL Key Server"
echo "========================================================================"
echo ""

# Check if MASTER_KEY is already set
if [ -z "${MASTER_KEY:-}" ]; then
  # Setup mode: Generate new keys
  echo "📝 Generating new master seed..."
  MASTER_KEY_RAW=$(/opt/key-server/bin/seal-cli gen-seed)
  GENERATED_MASTER_KEY=$(echo "$MASTER_KEY_RAW" | grep -oP "0x[a-f0-9]+" || echo "$MASTER_KEY_RAW")

  echo "✅ Master seed generated"
  echo ""

  # Create temporary config for key derivation
  cat > /app/config/derive-config.yaml <<EOF
network: Mainnet
server_mode: !Permissioned
  client_configs:
  - name: Temporary
    client_master_key: !Derived
      derivation_index: 0
    key_server_object_id: "0x0000000000000000000000000000000000000000000000000000000000000000"
    package_ids:
    - "0x0000000000000000000000000000000000000000000000000000000000000000"

server:
  address: "0.0.0.0:2024"
  metrics_address: "0.0.0.0:9184"

master_key:
  master_seed: "${GENERATED_MASTER_KEY}"

sui:
  url: "https://fullnode.mainnet.sui.io"
EOF

  echo ""
  echo "========================================================================"
  echo "🎉 MASTER KEY GENERATED"
  echo "========================================================================"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 MASTER_KEY (save to Railway secrets):"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "$GENERATED_MASTER_KEY"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📝 Next steps:"
  echo ""
  echo "1. Save the MASTER_KEY above to Railway environment variables"
  echo "2. Redeploy the service (it will output the PUBLIC_KEY in the logs)"
  echo "3. Use the PUBLIC_KEY from the logs to register on-chain:"
  echo ""
  echo "   sui client call \\"
  echo "     --package 0xa212c4c6c7183b911d0be8768f4cb1df7a383025b5d0ba0c014009f0f30f5f8d \\"
  echo "     --module key_server \\"
  echo "     --function create_and_transfer_v1 \\"
  echo "     --args <PUBLIC_KEY> <YOUR_ADDRESS> \\"
  echo "     --gas-budget 100000000"
  echo ""
  echo "4. Set KEY_SERVER_OBJECT_ID from the transaction and redeploy"
  echo ""
  echo "========================================================================"
  echo ""

  echo "⚠️  MASTER_KEY not set - staying in setup mode"
  echo ""
  echo "Keeping container alive for 90 seconds so you can copy the keys..."
  sleep 90
  exit 0
fi

# Production mode: MASTER_KEY is set
echo "✅ Using existing MASTER_KEY from Railway"

# Check if we have KEY_SERVER_OBJECT_ID
if [ -z "$KEY_SERVER_OBJECT_ID" ] || [ "$KEY_SERVER_OBJECT_ID" = "" ]; then
  echo "⚠️  KEY_SERVER_OBJECT_ID not set"
  echo ""
  echo "The key server will start and display the PUBLIC_KEY in the logs."
  echo "Look for 'Client \"SONAR Marketplace\" uses public key:' in the startup logs."
  echo ""
  echo "Once you have the PUBLIC_KEY:"
  echo ""
  echo "1. Register it on-chain:"
  echo "   sui client call \\"
  echo "     --package 0xa212c4c6c7183b911d0be8768f4cb1df7a383025b5d0ba0c014009f0f30f5f8d \\"
  echo "     --module key_server \\"
  echo "     --function create_and_transfer_v1 \\"
  echo "     --args <PUBLIC_KEY_FROM_LOGS> <YOUR_ADDRESS> \\"
  echo "     --gas-budget 100000000"
  echo ""
  echo "2. Set KEY_SERVER_OBJECT_ID environment variable and redeploy"
  echo ""
  echo "Starting key server in setup mode..."
  echo ""
fi

echo "🚀 Starting production key server..."
echo ""

# Strip any trailing newlines from environment variables
CLEAN_KEY_SERVER_ID=$(echo -n "${KEY_SERVER_OBJECT_ID}" | tr -d "\n\r")
CLEAN_MASTER_KEY=$(echo -n "${MASTER_KEY}" | tr -d "\n\r")

echo "📝 Generating config with:"
echo "   Key Server Object ID: ${CLEAN_KEY_SERVER_ID}"
echo ""

# Generate production config with cleaned values
sed "s|0x0000000000000000000000000000000000000000000000000000000000000000|${CLEAN_KEY_SERVER_ID}|g" /app/config/template.yaml | \
sed "s|master_seed:.*|master_seed: \"${CLEAN_MASTER_KEY}\"|g" > /app/config/key-server-config.yaml

echo "✅ Config generated at /app/config/key-server-config.yaml"
echo ""

export CONFIG_PATH=/app/config/key-server-config.yaml
exec /opt/key-server/bin/key-server
