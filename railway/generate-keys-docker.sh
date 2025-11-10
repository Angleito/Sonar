#!/bin/bash
# =============================================================================
# Quick Key Generation Using Docker
# =============================================================================
# This uses the same Docker image that Railway uses to generate keys quickly

set -e

echo "=========================================================================="
echo "🔐 Generating 2 New SEAL Key Server Keys (using Docker)"
echo "=========================================================================="
echo ""

# Build the Docker image (same as Railway)
echo "📦 Building SEAL Docker image..."
cd /Users/angel/Projects/sonar
docker build -f railway/Dockerfile -t sonar-seal:keygen --target builder . 2>&1 | grep -E "(Step|Successfully)" || true

echo ""
echo "✅ Docker image built"
echo ""

# Generate Key Server 2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 KEY SERVER 2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

MASTER_KEY_2=$(docker run --rm sonar-seal:keygen /work/target/release/seal-cli gen-seed | grep -oP "0x[a-f0-9]+")
echo "✅ MASTER_KEY_2=${MASTER_KEY_2}"

# Generate Key Server 3
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 KEY SERVER 3"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

MASTER_KEY_3=$(docker run --rm sonar-seal:keygen /work/target/release/seal-cli gen-seed | grep -oP "0x[a-f0-9]+")
echo "✅ MASTER_KEY_3=${MASTER_KEY_3}"

echo ""
echo "=========================================================================="
echo "📋 GENERATED KEYS - SAVE THESE!"
echo "=========================================================================="
echo ""
echo "KEY SERVER 2:"
echo "  MASTER_KEY=${MASTER_KEY_2}"
echo ""
echo "KEY SERVER 3:"
echo "  MASTER_KEY=${MASTER_KEY_3}"
echo ""
echo "=========================================================================="
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Go to Railway.app and add 2 new services to your Sonar project"
echo "2. For each service:"
echo "   - Link to your GitHub repo (Angleito/Sonar)"
echo "   - Set Railway/Dockerfile as the build configuration"
echo "   - Add environment variables (WILL GENERATE OBJECT IDs ON FIRST DEPLOY):"
echo ""
echo "   Service 2:"
echo "     MASTER_KEY=${MASTER_KEY_2}"
echo "     (leave KEY_SERVER_OBJECT_ID empty initially)"
echo ""
echo "   Service 3:"
echo "     MASTER_KEY=${MASTER_KEY_3}"
echo "     (leave KEY_SERVER_OBJECT_ID empty initially)"
echo ""
echo "3. Deploy both services - they will print PUBLIC_KEYs and registration commands"
echo "4. Register the public keys on-chain to get KEY_SERVER_OBJECT_IDs"
echo "5. Add KEY_SERVER_OBJECT_IDs to Railway and redeploy"
echo "6. Update Vercel with all 3 key server IDs comma-separated"
echo ""
echo "=========================================================================="
