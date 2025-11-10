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

  echo "📝 Deriving public key from generated master key..."
  # Use seal-cli to deterministically derive (Masterkey, Publickey) for index 0
  PUBLIC_KEY=$(/opt/key-server/bin/seal-cli derive-key --seed "${GENERATED_MASTER_KEY}" --index 0 | awk '/Publickey:/ {print $2; exit}')
  if [ -z "$PUBLIC_KEY" ]; then
    PUBLIC_KEY="DERIVATION_FAILED"
  fi

  echo ""
  echo "========================================================================"
  echo "🎉 KEY MATERIAL GENERATED"
  echo "========================================================================"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 MASTER_KEY (save to Railway secrets):"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "$GENERATED_MASTER_KEY"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 PUBLIC_KEY (for on-chain registration):"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "${PUBLIC_KEY}"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📝 Register on-chain:"
  echo ""
  echo "sui client call \\"
  echo "  --package 0xa212c4c6c7183b911d0be8768f4cb1df7a383025b5d0ba0c014009f0f30f5f8d \\"
  echo "  --module key_server \\"
  echo "  --function create_and_transfer_v1 \\"
  echo "  --args ${PUBLIC_KEY} <YOUR_ADDRESS> \\"
  echo "  --gas-budget 100000000"
  echo ""
  echo "Then set Railway env vars and redeploy:"
  echo "  MASTER_KEY=$GENERATED_MASTER_KEY"
  echo "  KEY_SERVER_OBJECT_ID=<object ID from transaction>"
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
  echo "⚠️  KEY_SERVER_OBJECT_ID not set - deriving PUBLIC_KEY for registration"
  echo ""

  # Create temporary config for key derivation
  cat > /app/config/derive-config.yaml <<'EOFCONFIG'
network: Mainnet

server_mode: !Permissionless

server:
  address: "0.0.0.0:2024"
  metrics_address: "0.0.0.0:9184"

master_key:
  master_seed: "REPLACE_MASTER_KEY"

sui:
  url: "https://fullnode.mainnet.sui.io"
EOFCONFIG

  echo "📝 Deriving public key from master key..."
  # Use seal-cli to deterministically derive (Masterkey, Publickey) for index 0
  PUBLIC_KEY=$(/opt/key-server/bin/seal-cli derive-key --seed "${MASTER_KEY}" --index 0 | awk '/Publickey:/ {print $2; exit}')
  if [ -z "$PUBLIC_KEY" ]; then
    PUBLIC_KEY="DERIVATION_FAILED"
  fi

  echo ""
  echo "========================================================================"
  echo "🎉 PUBLIC KEY DERIVED"
  echo "========================================================================"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 PUBLIC_KEY (for on-chain registration):"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "${PUBLIC_KEY}"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📝 Register on-chain:"
  echo ""
  echo "sui client call \\"
  echo "  --package 0xa212c4c6c7183b911d0be8768f4cb1df7a383025b5d0ba0c014009f0f30f5f8d \\"
  echo "  --module key_server \\"
  echo "  --function create_and_transfer_v1 \\"
  echo "  --args ${PUBLIC_KEY} YOUR_WALLET_ADDRESS \\"
  echo "  --gas-budget 100000000"
  echo ""
  echo "Then add the KEY_SERVER_OBJECT_ID from the transaction to Railway and redeploy"
  echo ""
  echo "========================================================================"
  echo ""

  echo "⏳ Keeping container alive for 90 seconds so you can copy the PUBLIC_KEY..."
  sleep 90
  exit 0
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
