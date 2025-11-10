#!/bin/bash
# =============================================================================
# Deploy 3 SEAL Key Servers to Railway
# =============================================================================
# This script automates the deployment of 3 key servers for 2-of-3 threshold encryption

set -e

echo "=========================================================================="
echo "🔐 SONAR SEAL - Deploy 3 Key Servers to Railway"
echo "=========================================================================="
echo ""

# Master keys
MASTER_KEY_1="0xe78095e96a5f5d6ebf62664dc6fbe07d913927a829ab7181d1b42febe4d6fcc8"
MASTER_KEY_2="0x382dbed9533b2a4f4b1be4566e61457b3c6f481d0d403da3816268758c64933b"
MASTER_KEY_3="0x8953a013dd3e67edaf0850875d2b7289b7097a3de4321111d6cedc678996900b"

# Existing Key Server 1 object ID
KEY_SERVER_OBJECT_ID_1="0x6b061391f1352bd6ebbe68e98d007b52b202375ee7014c49b76faef737aee627"

echo "📋 Configuration:"
echo ""
echo "Key Server 1 (existing):"
echo "  MASTER_KEY=${MASTER_KEY_1}"
echo "  KEY_SERVER_OBJECT_ID=${KEY_SERVER_OBJECT_ID_1}"
echo ""
echo "Key Server 2 (new):"
echo "  MASTER_KEY=${MASTER_KEY_2}"
echo "  KEY_SERVER_OBJECT_ID=(to be generated)"
echo ""
echo "Key Server 3 (new):"
echo "  MASTER_KEY=${MASTER_KEY_3}"
echo "  KEY_SERVER_OBJECT_ID=(to be generated)"
echo ""
echo "=========================================================================="
echo ""

# Check if railway is logged in
if ! railway whoami &>/dev/null; then
    echo "❌ Not logged in to Railway"
    echo "Please run: railway login"
    exit 1
fi

echo "✅ Logged in to Railway as: $(railway whoami)"
echo ""

# Change to railway directory
cd /Users/angel/Projects/sonar/railway

echo "📝 Step 1: Creating Railway services..."
echo ""
echo "⚠️  Railway CLI requires interactive input for service creation."
echo "    I'll guide you through the manual steps:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "MANUAL STEPS REQUIRED:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Go to: https://railway.app/project/$(railway status | grep 'Project:' | awk '{print $2}')"
echo ""
echo "2. Click 'New' → 'Empty Service'"
echo ""
echo "3. Name it: 'Sonar-KeyServer-2'"
echo ""
echo "4. Click on the service → Settings → Variables"
echo "   Add these variables:"
echo "   MASTER_KEY=${MASTER_KEY_2}"
echo "   CONFIG_PATH=/app/config/key-server-config.yaml"
echo ""
echo "5. Go to Settings → 'Connect to GitHub repo'"
echo "   - Select: Angleito/Sonar"
echo "   - Root Directory: railway"
echo "   - Watch Paths: railway/**"
echo ""
echo "6. The service will auto-deploy. Check the logs for PUBLIC_KEY"
echo ""
echo "7. Repeat steps 2-6 for 'Sonar-KeyServer-3' with:"
echo "   MASTER_KEY=${MASTER_KEY_3}"
echo "   CONFIG_PATH=/app/config/key-server-config.yaml"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Press Enter once you've created both services and they're deployed..."
echo ""

echo "📝 Step 2: Getting public keys from deployment logs..."
echo ""
echo "Run these commands to get the logs:"
echo ""
echo "  railway service Sonar-KeyServer-2"
echo "  railway logs | grep 'PUBLIC_KEY'"
echo ""
echo "  railway service Sonar-KeyServer-3"
echo "  railway logs | grep 'PUBLIC_KEY'"
echo ""
read -p "Enter PUBLIC_KEY for Key Server 2: " PUBLIC_KEY_2
read -p "Enter PUBLIC_KEY for Key Server 3: " PUBLIC_KEY_3
echo ""

echo "✅ Received public keys:"
echo "  Key Server 2: ${PUBLIC_KEY_2}"
echo "  Key Server 3: ${PUBLIC_KEY_3}"
echo ""

echo "📝 Step 3: Registering public keys on-chain..."
echo ""
echo "Run these commands to register on Sui mainnet:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Register Key Server 2:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "sui client call \\"
echo "  --package 0xa212c4c6c7183b911d0be8768f4cb1df7a383025b5d0ba0c014009f0f30f5f8d \\"
echo "  --module key_server \\"
echo "  --function create_and_transfer_v1 \\"
echo "  --args ${PUBLIC_KEY_2} \$(sui client active-address) \\"
echo "  --gas-budget 100000000"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Register Key Server 3:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "sui client call \\"
echo "  --package 0xa212c4c6c7183b911d0be8768f4cb1df7a383025b5d0ba0c014009f0f30f5f8d \\"
echo "  --module key_server \\"
echo "  --function create_and_transfer_v1 \\"
echo "  --args ${PUBLIC_KEY_3} \$(sui client active-address) \\"
echo "  --gas-budget 100000000"
echo ""
read -p "Press Enter once both transactions are complete..."
echo ""

read -p "Enter KEY_SERVER_OBJECT_ID from transaction 1: " KEY_SERVER_OBJECT_ID_2
read -p "Enter KEY_SERVER_OBJECT_ID from transaction 2: " KEY_SERVER_OBJECT_ID_3
echo ""

echo "✅ Received object IDs:"
echo "  Key Server 2: ${KEY_SERVER_OBJECT_ID_2}"
echo "  Key Server 3: ${KEY_SERVER_OBJECT_ID_3}"
echo ""

echo "📝 Step 4: Updating Railway services with KEY_SERVER_OBJECT_IDs..."
echo ""
echo "Updating Sonar-KeyServer-2..."
railway service Sonar-KeyServer-2 2>/dev/null || true
railway variables --set "KEY_SERVER_OBJECT_ID=${KEY_SERVER_OBJECT_ID_2}" 2>/dev/null || {
    echo "⚠️  Auto-update failed. Please manually add to Sonar-KeyServer-2:"
    echo "   KEY_SERVER_OBJECT_ID=${KEY_SERVER_OBJECT_ID_2}"
}
echo ""

echo "Updating Sonar-KeyServer-3..."
railway service Sonar-KeyServer-3 2>/dev/null || true
railway variables --set "KEY_SERVER_OBJECT_ID=${KEY_SERVER_OBJECT_ID_3}" 2>/dev/null || {
    echo "⚠️  Auto-update failed. Please manually add to Sonar-KeyServer-3:"
    echo "   KEY_SERVER_OBJECT_ID=${KEY_SERVER_OBJECT_ID_3}"
}
echo ""

echo "📝 Step 5: Updating Vercel with all 3 key server IDs..."
echo ""

ALL_KEY_SERVERS="${KEY_SERVER_OBJECT_ID_1},${KEY_SERVER_OBJECT_ID_2},${KEY_SERVER_OBJECT_ID_3}"

echo "Removing old NEXT_PUBLIC_SEAL_KEY_SERVERS..."
cd /Users/angel/Projects/sonar/frontend
vercel env rm NEXT_PUBLIC_SEAL_KEY_SERVERS production --yes 2>/dev/null || true
vercel env rm NEXT_PUBLIC_SEAL_KEY_SERVERS preview --yes 2>/dev/null || true
vercel env rm NEXT_PUBLIC_SEAL_KEY_SERVERS development --yes 2>/dev/null || true

echo "Adding new NEXT_PUBLIC_SEAL_KEY_SERVERS with all 3 IDs..."
echo -n "${ALL_KEY_SERVERS}" | vercel env add NEXT_PUBLIC_SEAL_KEY_SERVERS production
echo -n "${ALL_KEY_SERVERS}" | vercel env add NEXT_PUBLIC_SEAL_KEY_SERVERS preview
echo -n "${ALL_KEY_SERVERS}" | vercel env add NEXT_PUBLIC_SEAL_KEY_SERVERS development

echo ""
echo "✅ Vercel updated with: ${ALL_KEY_SERVERS}"
echo ""

echo "📝 Step 6: Triggering Vercel redeploy..."
cd /Users/angel/Projects/sonar
git commit --allow-empty -m "Deploy 3 SEAL key servers for 2-of-3 threshold encryption

Key Server IDs:
- ${KEY_SERVER_OBJECT_ID_1} (existing)
- ${KEY_SERVER_OBJECT_ID_2} (new)
- ${KEY_SERVER_OBJECT_ID_3} (new)

This provides proper threshold security where any 2 of 3 servers
can decrypt, improving both security and reliability."

git push

echo ""
echo "=========================================================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "=========================================================================="
echo ""
echo "✅ 3 Key servers deployed to Railway"
echo "✅ All registered on-chain"
echo "✅ Vercel updated with all 3 IDs"
echo "✅ Frontend redeploying"
echo ""
echo "Key Server Configuration:"
echo "  1. ${KEY_SERVER_OBJECT_ID_1}"
echo "  2. ${KEY_SERVER_OBJECT_ID_2}"
echo "  3. ${KEY_SERVER_OBJECT_ID_3}"
echo ""
echo "Threshold: 2-of-3 (any 2 servers can decrypt)"
echo ""
echo "Monitor deployments:"
echo "  Railway: https://railway.app"
echo "  Vercel: https://vercel.com"
echo ""
echo "=========================================================================="
