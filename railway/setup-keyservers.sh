#!/bin/bash
# =============================================================================
# SEAL Key Server Setup Script
# =============================================================================
# This script generates master keys and public keys for 2 additional key servers
# You'll need to:
# 1. Run this script to generate keys
# 2. Register the public keys on-chain to get KEY_SERVER_OBJECT_IDs
# 3. Create Railway services and set the environment variables
# 4. Update frontend NEXT_PUBLIC_SEAL_KEY_SERVERS with all 3 IDs

set -e

echo "=========================================================================="
echo "🔐 SONAR SEAL Key Server Setup"
echo "=========================================================================="
echo ""
echo "Generating keys for 2 additional key servers..."
echo ""

# Check if seal-cli is available
if ! command -v seal-cli &> /dev/null; then
    echo "❌ seal-cli not found. Installing..."

    # Clone SEAL repo if not exists
    if [ ! -d "/tmp/seal-build" ]; then
        git clone https://github.com/MystenLabs/seal.git /tmp/seal-build
    fi

    cd /tmp/seal-build
    cargo build --bin seal-cli --release
    SEAL_CLI="/tmp/seal-build/target/release/seal-cli"
else
    SEAL_CLI="seal-cli"
fi

echo "✅ Using seal-cli at: $SEAL_CLI"
echo ""

# Generate Key Server 2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 KEY SERVER 2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

MASTER_KEY_2_RAW=$($SEAL_CLI gen-seed)
MASTER_KEY_2=$(echo "$MASTER_KEY_2_RAW" | grep -oP "0x[a-f0-9]+" || echo "$MASTER_KEY_2_RAW")

echo "📝 Deriving public key for Key Server 2..."

# Create temporary config for derivation
cat > /tmp/derive-config-2.yaml <<EOF
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
  master_seed: "${MASTER_KEY_2}"

sui:
  url: "https://fullnode.mainnet.sui.io"
EOF

# Run key server briefly to derive public key
CONFIG_PATH=/tmp/derive-config-2.yaml timeout 5 /tmp/seal-build/target/release/key-server 2>&1 | tee /tmp/derive-2.log || true
PUBLIC_KEY_2=$(grep -oP "Derived public key for index 0: \K0x[a-f0-9]+" /tmp/derive-2.log || echo "DERIVATION_FAILED")

echo ""
echo "✅ Master Key 2: ${MASTER_KEY_2}"
echo "✅ Public Key 2: ${PUBLIC_KEY_2}"
echo ""

# Generate Key Server 3
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 KEY SERVER 3"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

MASTER_KEY_3_RAW=$($SEAL_CLI gen-seed)
MASTER_KEY_3=$(echo "$MASTER_KEY_3_RAW" | grep -oP "0x[a-f0-9]+" || echo "$MASTER_KEY_3_RAW")

echo "📝 Deriving public key for Key Server 3..."

# Create temporary config for derivation
cat > /tmp/derive-config-3.yaml <<EOF
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
  master_seed: "${MASTER_KEY_3}"

sui:
  url: "https://fullnode.mainnet.sui.io"
EOF

# Run key server briefly to derive public key
CONFIG_PATH=/tmp/derive-config-3.yaml timeout 5 /tmp/seal-build/target/release/key-server 2>&1 | tee /tmp/derive-3.log || true
PUBLIC_KEY_3=$(grep -oP "Derived public key for index 0: \K0x[a-f0-9]+" /tmp/derive-3.log || echo "DERIVATION_FAILED")

echo ""
echo "✅ Master Key 3: ${MASTER_KEY_3}"
echo "✅ Public Key 3: ${PUBLIC_KEY_3}"
echo ""

# Summary
echo "=========================================================================="
echo "📋 SUMMARY - SAVE THESE VALUES"
echo "=========================================================================="
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "KEY SERVER 2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "MASTER_KEY=${MASTER_KEY_2}"
echo "PUBLIC_KEY=${PUBLIC_KEY_2}"
echo ""
echo "Register on-chain:"
echo "sui client call \\"
echo "  --package 0xa212c4c6c7183b911d0be8768f4cb1df7a383025b5d0ba0c014009f0f30f5f8d \\"
echo "  --module key_server \\"
echo "  --function create_and_transfer_v1 \\"
echo "  --args ${PUBLIC_KEY_2} <YOUR_ADDRESS> \\"
echo "  --gas-budget 100000000"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "KEY SERVER 3"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "MASTER_KEY=${MASTER_KEY_3}"
echo "PUBLIC_KEY=${PUBLIC_KEY_3}"
echo ""
echo "Register on-chain:"
echo "sui client call \\"
echo "  --package 0xa212c4c6c7183b911d0be8768f4cb1df7a383025b5d0ba0c014009f0f30f5f8d \\"
echo "  --module key_server \\"
echo "  --function create_and_transfer_v1 \\"
echo "  --args ${PUBLIC_KEY_3} <YOUR_ADDRESS> \\"
echo "  --gas-budget 100000000"
echo ""
echo "=========================================================================="
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Run the on-chain registration commands above"
echo "2. Get the KEY_SERVER_OBJECT_ID from each transaction"
echo "3. Create Railway services:"
echo "   - Service: Sonar-KeyServer-2"
echo "     MASTER_KEY=${MASTER_KEY_2}"
echo "     KEY_SERVER_OBJECT_ID=<from transaction 1>"
echo ""
echo "   - Service: Sonar-KeyServer-3"
echo "     MASTER_KEY=${MASTER_KEY_3}"
echo "     KEY_SERVER_OBJECT_ID=<from transaction 2>"
echo ""
echo "4. Update Vercel NEXT_PUBLIC_SEAL_KEY_SERVERS with all 3 IDs"
echo ""
echo "=========================================================================="
