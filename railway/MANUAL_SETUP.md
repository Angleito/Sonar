# Manual Setup: 3 SEAL Key Servers on Railway

This guide walks you through setting up 3 key servers for 2-of-3 threshold encryption.

## Overview

- **Key Server 1**: Already running ✅
- **Key Server 2**: Need to create
- **Key Server 3**: Need to create

## Master Keys (Pre-generated)

```bash
# Key Server 1 (existing)
MASTER_KEY_1=0xe78095e96a5f5d6ebf62664dc6fbe07d913927a829ab7181d1b42febe4d6fcc8
KEY_SERVER_OBJECT_ID_1=0x6b061391f1352bd6ebbe68e98d007b52b202375ee7014c49b76faef737aee627

# Key Server 2 (new)
MASTER_KEY_2=0x382dbed9533b2a4f4b1be4566e61457b3c6f481d0d403da3816268758c64933b
KEY_SERVER_OBJECT_ID_2=(will be generated)

# Key Server 3 (new)
MASTER_KEY_3=0x8953a013dd3e67edaf0850875d2b7289b7097a3de4321111d6cedc678996900b
KEY_SERVER_OBJECT_ID_3=(will be generated)
```

---

## Step 1: Create Key Server 2 on Railway

### 1.1 Create New Service

1. Go to https://railway.app
2. Open your "Sonar" project
3. Click **"New"** → **"Empty Service"**
4. Name it: **`Sonar-KeyServer-2`**

### 1.2 Connect to GitHub

1. Click on the new service
2. Go to **Settings** → **Source**
3. Click **"Connect Repo"**
4. Select **`Angleito/Sonar`**
5. Set **Root Directory**: `railway`
6. Set **Watch Paths**: `railway/**`

### 1.3 Add Environment Variables

In Settings → Variables, add:

```bash
MASTER_KEY=0x382dbed9533b2a4f4b1be4566e61457b3c6f481d0d403da3816268758c64933b
CONFIG_PATH=/app/config/key-server-config.yaml
```

**Important**: Leave `KEY_SERVER_OBJECT_ID` empty for now!

### 1.4 Deploy and Get Public Key

1. The service will auto-deploy
2. Go to **Deployments** → Click latest deployment → **View Logs**
3. Look for this section in the logs:

```
========================================================================
🎉 KEY MATERIAL GENERATED
========================================================================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PUBLIC_KEY (for on-chain registration):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

0xABCDEF123456... (your actual public key)
```

4. **SAVE THIS PUBLIC_KEY** - you'll need it in Step 3!

---

## Step 2: Create Key Server 3 on Railway

Repeat Step 1 but with:

- **Service Name**: `Sonar-KeyServer-3`
- **MASTER_KEY**: `0x8953a013dd3e67edaf0850875d2b7289b7097a3de4321111d6cedc678996900b`
- **CONFIG_PATH**: `/app/config/key-server-config.yaml`

Save the PUBLIC_KEY from the logs!

---

## Step 3: Register Public Keys On-Chain

### 3.1 Make sure you're on mainnet

```bash
sui client active-env
# Should show: mainnet

# If not:
sui client switch --env mainnet
```

### 3.2 Register Key Server 2

```bash
sui client call \
  --package 0xa212c4c6c7183b911d0be8768f4cb1df7a383025b5d0ba0c014009f0f30f5f8d \
  --module key_server \
  --function create_and_transfer_v1 \
  --args <PUBLIC_KEY_2_FROM_LOGS> $(sui client active-address) \
  --gas-budget 100000000
```

Look for `objectChanges` in the output with type `key_server::KeyServer`:

```json
{
  "objectId": "0x123abc...",  ← This is KEY_SERVER_OBJECT_ID_2
  "objectType": "0x...::key_server::KeyServer"
}
```

**SAVE KEY_SERVER_OBJECT_ID_2**

### 3.3 Register Key Server 3

Repeat 3.2 with PUBLIC_KEY_3 from logs.

**SAVE KEY_SERVER_OBJECT_ID_3**

---

## Step 4: Update Railway with Object IDs

### 4.1 Update Key Server 2

1. Go to Railway → Sonar-KeyServer-2 → Settings → Variables
2. Add new variable:
   ```
   KEY_SERVER_OBJECT_ID=<KEY_SERVER_OBJECT_ID_2_FROM_STEP_3>
   ```
3. The service will auto-redeploy

### 4.2 Update Key Server 3

1. Go to Railway → Sonar-KeyServer-3 → Settings → Variables
2. Add new variable:
   ```
   KEY_SERVER_OBJECT_ID=<KEY_SERVER_OBJECT_ID_3_FROM_STEP_3>
   ```
3. The service will auto-redeploy

---

## Step 5: Update Vercel with All 3 IDs

### 5.1 Remove old variable

```bash
cd /Users/angel/Projects/sonar/frontend

vercel env rm NEXT_PUBLIC_SEAL_KEY_SERVERS production --yes
vercel env rm NEXT_PUBLIC_SEAL_KEY_SERVERS preview --yes
vercel env rm NEXT_PUBLIC_SEAL_KEY_SERVERS development --yes
```

### 5.2 Add new variable with all 3 IDs

```bash
# Format: ID1,ID2,ID3 (comma-separated, no spaces)
ALL_IDS="0x6b061391f1352bd6ebbe68e98d007b52b202375ee7014c49b76faef737aee627,<ID_2>,<ID_3>"

echo -n "$ALL_IDS" | vercel env add NEXT_PUBLIC_SEAL_KEY_SERVERS production
echo -n "$ALL_IDS" | vercel env add NEXT_PUBLIC_SEAL_KEY_SERVERS preview
echo -n "$ALL_IDS" | vercel env add NEXT_PUBLIC_SEAL_KEY_SERVERS development
```

### 5.3 Trigger Vercel redeploy

```bash
cd /Users/angel/Projects/sonar

git commit --allow-empty -m "Deploy 3 SEAL key servers for 2-of-3 threshold encryption"
git push
```

---

## Step 6: Verify Everything Works

### 6.1 Check Railway Services

All 3 services should show "Active" with recent logs showing:

```
✅ Config generated at /app/config/key-server-config.yaml
🚀 Starting production key server...
```

### 6.2 Check Vercel Deployment

1. Wait for Vercel build to complete
2. Go to your deployed site
3. Try uploading a file with encryption
4. Should work without errors!

---

## Troubleshooting

### Service keeps crashing

Check logs for:
- `AccountAddressParseError` → KEY_SERVER_OBJECT_ID has newlines or invalid format
- `package not found` → Wrong package ID in config

### Encryption fails

Check browser console:
- "Key server is not valid" → Railway service not running or wrong package whitelist
- "Object does not exist" → KEY_SERVER_OBJECT_ID not registered on-chain or wrong network

---

## Summary

When complete, you'll have:

✅ 3 key servers running on Railway
✅ All registered on-chain
✅ Vercel configured with all 3 IDs
✅ 2-of-3 threshold encryption working

**Security**: Any 2 of the 3 key servers can decrypt, providing redundancy and improved security!
