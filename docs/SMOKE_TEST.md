# SONAR Kiosk System - Manual Smoke Test

Complete end-to-end smoke test checklist for verifying the SONAR Kiosk Liquidity Pool on Sui testnet.

**Estimated Time**: 1-2 hours
**Prerequisites**: 2 Sui testnet wallets with SUI tokens

---

## Prerequisites Checklist

### 1. Environment Setup

- [ ] **PostgreSQL Running**
  ```bash
  # macOS
  brew services start postgresql@14

  # Verify
  psql -U postgres -c "SELECT 1"
  ```

- [ ] **Database Migrated**
  ```bash
  cd /Users/angel/Projects/sonar/backend
  bun prisma migrate deploy
  bun prisma db seed
  ```

- [ ] **Environment Variables Set**
  - [ ] Backend `.env` has all required variables (SUI_RPC_URL, SONAR_PACKAGE_ID, etc.)
  - [ ] Frontend `.env.local` has NEXT_PUBLIC_BACKEND_URL

- [ ] **Backend Running**
  ```bash
  cd /Users/angel/Projects/sonar/backend
  bun run dev

  # Verify health
  curl http://localhost:3001/health
  ```

- [ ] **Frontend Running**
  ```bash
  cd /Users/angel/Projects/sonar/frontend
  bun run dev

  # Open http://localhost:3000
  ```

### 2. Smart Contract Deployment

- [ ] **SONAR Package Published**
  ```bash
  cd /Users/angel/Projects/sonar/contracts
  sui move build
  sui client publish --gas-budget 100000000

  # Record PACKAGE_ID
  export PACKAGE_ID="0x..."
  ```

- [ ] **Marketplace Object Created**
  - [ ] Record MARKETPLACE_ID from publish output
  - [ ] Update backend `.env` with MARKETPLACE_ID

- [ ] **Kiosk Funded with SONAR**
  ```bash
  cd /Users/angel/Projects/sonar/scripts
  ./kiosk-admin.sh fund 10000000  # 10M SONAR

  # Verify
  ./kiosk-admin.sh status
  ```

### 3. Test Data

- [ ] **Real Audio Files Uploaded to Walrus**
  ```bash
  # Follow guide: docs/WALRUS_UPLOAD_GUIDE.md
  ./scripts/upload-to-walrus.sh /path/to/audio1.wav
  ./scripts/upload-to-walrus.sh /path/to/audio2.wav
  ./scripts/upload-to-walrus.sh /path/to/audio3.wav
  ```

- [ ] **Dataset Seed Data Updated**
  ```bash
  # Update backend/seed/kiosk-datasets.json with real blob IDs
  nano backend/seed/kiosk-datasets.json

  # Re-seed database
  cd backend
  bun run scripts/seed-kiosk.ts
  ```

### 4. Test Wallets

- [ ] **Wallet 1 (Two-Step Flow)**
  - Address: `___________________________`
  - Has ≥ 10 SUI testnet tokens
  - Has 0 SONAR tokens initially

- [ ] **Wallet 2 (One-Step Flow)**
  - Address: `___________________________`
  - Has ≥ 10 SUI testnet tokens
  - Has 0 SONAR tokens initially

Get testnet SUI:
```bash
sui client faucet --address <WALLET_ADDRESS>
```

---

## Test Execution

### Test 1: Backend Health & Monitoring

**Objective**: Verify backend APIs and monitoring are functional

#### 1.1 Health Check

```bash
curl http://localhost:3001/health | jq
```

**Expected**:
```json
{
  "status": "ok",
  "database": true,
  "walrus": true
}
```

- [ ] Status is "ok"
- [ ] Database connection is true

#### 1.2 Kiosk Price API

```bash
curl http://localhost:3001/api/kiosk/price | jq
```

**Expected**:
```json
{
  "sonar_price": "1000000000",
  "sui_price": "0.001",
  "reserve_balance": {
    "sonar": "10000000000000000",
    "sui": "0"
  },
  "current_tier": 1
}
```

- [ ] Price is returned (1.0 SUI for Tier 1)
- [ ] Reserve balance shows ≥10M SONAR
- [ ] Current tier is correct

#### 1.3 Monitoring Endpoints

```bash
# Metrics
curl http://localhost:3001/api/monitoring/kiosk/metrics | jq

# Health checks
curl http://localhost:3001/api/monitoring/kiosk/health | jq
```

**Expected**:
- [ ] Metrics show healthy reserve levels
- [ ] No critical alerts
- [ ] Success rate is 100% (no purchases yet)

---

### Test 2: Frontend Marketplace Display

**Objective**: Verify marketplace loads datasets correctly

#### 2.1 Open Marketplace

1. Navigate to http://localhost:3000/marketplace
2. Wait for datasets to load

**Expected**:
- [ ] 3 datasets displayed
- [ ] Each card shows: title, price, duration, quality score
- [ ] Preview waveforms are visible
- [ ] No error toasts

#### 2.2 Dataset Detail Page

1. Click on first dataset card
2. Wait for detail page to load

**Expected**:
- [ ] Dataset title and description displayed
- [ ] Price shown in SONAR
- [ ] Waveform player visible
- [ ] "Purchase Dataset" button visible
- [ ] Kiosk price badge shows current SUI/SONAR rate

#### 2.3 Preview Playback

1. Click play on waveform player
2. Wait for audio to load from Walrus

**Expected**:
- [ ] Audio plays successfully
- [ ] Waveform shows progress
- [ ] No CORS errors in console
- [ ] Audio quality is acceptable

---

### Test 3: Two-Step Purchase Flow (Wallet 1)

**Objective**: Complete two-step purchase: buy SONAR → buy dataset

#### 3.1 Connect Wallet 1

1. Click "Connect Wallet" in navbar
2. Select Sui Wallet
3. Approve connection in wallet extension

**Expected**:
- [ ] Wallet address displayed in navbar
- [ ] Matches Wallet 1 address

#### 3.2 Navigate to Dataset

1. Go to marketplace
2. Click on a dataset (e.g., "Ambient Meditation")
3. Click "Try kiosk" if prompted

**Expected**:
- [ ] Kiosk purchase UI displayed
- [ ] Shows current SONAR price
- [ ] Shows dataset price in SONAR

#### 3.3 Select Two-Step Flow

1. Click "2-Step: Buy SONAR First" button
2. Wait for Step 1 UI

**Expected**:
- [ ] UI shows "Step 1 of 2: Buy SONAR"
- [ ] Shows SUI amount required
- [ ] "Buy SONAR" button enabled

#### 3.4 Buy SONAR from Kiosk

1. Click "Buy SONAR" button
2. Approve transaction in wallet
3. Wait for confirmation

**Expected**:
- [ ] Wallet approval popup appears
- [ ] Transaction submits successfully
- [ ] Success toast: "SONAR purchased successfully"
- [ ] UI advances to Step 2
- [ ] SONAR balance updates in UI

**Troubleshooting**:
- If "Insufficient SUI": Get more testnet SUI from faucet
- If "Kiosk out of SONAR": Fund kiosk with `./kiosk-admin.sh fund 10000000`
- If transaction fails: Check RPC endpoint and gas budget

#### 3.5 Purchase Dataset

1. Verify Step 2 UI is shown
2. Click "Buy Dataset" button
3. Approve transaction in wallet
4. Wait for confirmation

**Expected**:
- [ ] UI shows "Step 2 of 2: Buy Dataset"
- [ ] "Buy Dataset" button enabled
- [ ] Transaction submits successfully
- [ ] Success toast: "Dataset purchased successfully"
- [ ] Access granted automatically

**Troubleshooting**:
- If "Insufficient SONAR": Repeat step 3.4
- If transaction fails: Check dataset is still listed

#### 3.6 Verify Access Granted

1. Wait for download button to appear
2. Check console for access verification

**Expected**:
- [ ] "Download" button visible
- [ ] Backend verified purchase on-chain
- [ ] Access grant includes download_url and blob_id
- [ ] No access denied errors

#### 3.7 Download Full Audio

1. Click "Download" button
2. Wait for download to complete

**Expected**:
- [ ] File downloads successfully
- [ ] File size > 10MB (5+ minute audio)
- [ ] Audio plays correctly when opened

---

### Test 4: One-Step Purchase Flow (Wallet 2)

**Objective**: Complete one-step purchase: pay SUI directly

#### 4.1 Switch Wallet

1. Disconnect Wallet 1
2. Connect Wallet 2
3. Verify different address

**Expected**:
- [ ] Navbar shows Wallet 2 address
- [ ] Previous purchases not visible (different wallet)

#### 4.2 Navigate to Different Dataset

1. Go to marketplace
2. Click on a different dataset (e.g., "Nature Sounds")
3. Switch to kiosk flow

**Expected**:
- [ ] Kiosk UI loaded
- [ ] Shows correct SUI cost calculation
- [ ] Dataset price × SONAR price = SUI cost

#### 4.3 Select One-Step Flow

1. Click "1-Step: Buy Now" button
2. Verify UI shows single transaction

**Expected**:
- [ ] UI shows "Pay with SUI"
- [ ] Total SUI cost displayed
- [ ] "Buy Now" button enabled

#### 4.4 Purchase Dataset with SUI

1. Click "Buy Now" button
2. Approve transaction in wallet
3. Wait for confirmation

**Expected**:
- [ ] Transaction submits successfully
- [ ] Success toast: "Dataset purchased successfully"
- [ ] Access granted immediately (no second step)
- [ ] Transaction link visible

**Troubleshooting**:
- If underpayment error: Bug in SUI calculation (check `calculateSuiNeeded`)
- If overpayment: Verify ceiling division is working
- If kiosk failure: Check kiosk SONAR reserve

#### 4.5 Verify Access

1. Check download button appears
2. Click download
3. Verify file downloads

**Expected**:
- [ ] Immediate access (no delay)
- [ ] Download succeeds
- [ ] File is correct dataset

---

### Test 5: Backend Purchase Verification

**Objective**: Verify backend recorded purchases correctly

#### 5.1 Check Kiosk Purchases Table

```bash
cd /Users/angel/Projects/sonar/backend
bun prisma studio
# Navigate to KioskPurchase table
```

**Expected**:
- [ ] 2 purchase records exist (one per wallet)
- [ ] `user_address` matches wallet addresses
- [ ] `dataset_id` is correct
- [ ] `sonar_amount` matches dataset price
- [ ] `tx_digest` is populated
- [ ] `event_signature` is unique (SHA256 hash)

#### 5.2 Check Idempotency

```bash
# Try to process same event again (manually)
# Should be prevented by unique event_signature constraint
```

**Expected**:
- [ ] Duplicate event_signature rejected by database
- [ ] No duplicate purchase records created

#### 5.3 Verify Access Logs

```bash
# In Prisma Studio, check AccessLog table
```

**Expected**:
- [ ] Access attempts logged
- [ ] Status is "granted" for both purchases
- [ ] Timestamp matches purchase time

---

### Test 6: Kiosk Reserve Updates

**Objective**: Verify kiosk reserves changed correctly

#### 6.1 Check Reserve Balances

```bash
curl http://localhost:3001/api/kiosk/status | jq
```

**Expected**:
- [ ] SONAR reserve decreased (sold to users)
- [ ] SUI reserve increased (collected from sales)
- [ ] 24h sales metrics show 2 transactions

#### 6.2 Verify Price Tier (if applicable)

If reserves crossed tier boundary:

**Expected**:
- [ ] Tier changed (e.g., 1 → 2)
- [ ] Price adjusted (e.g., 1.0 → 0.8 SUI)
- [ ] Tier transition logged in price_history table

---

### Test 7: Monitoring Dashboard

**Objective**: Verify admin monitoring works

#### 7.1 Open Monitoring Page

1. Navigate to http://localhost:3000/admin/monitoring
2. Wait for metrics to load

**Expected**:
- [ ] Overall health shows "Healthy" (green)
- [ ] SONAR reserve level displayed
- [ ] SUI reserve level displayed
- [ ] Success rate shows 100% (2/2 successful)
- [ ] No active alerts

#### 7.2 Verify Metrics Accuracy

Compare dashboard to database:

**Expected**:
- [ ] Reserve balances match `/api/kiosk/status`
- [ ] Purchase counts match KioskPurchase table
- [ ] Depletion rate calculated correctly
- [ ] Tier displayed correctly

#### 7.3 Test Auto-Refresh

1. Wait 30 seconds
2. Verify metrics refresh automatically

**Expected**:
- [ ] Page refreshes without full reload
- [ ] Metrics update (or stay same if no changes)
- [ ] No loading errors

---

### Test 8: Error Handling

**Objective**: Verify error cases handled gracefully

#### 8.1 Insufficient Balance

1. Try to purchase with empty wallet
2. Approve transaction

**Expected**:
- [ ] Transaction fails in wallet
- [ ] Error toast displayed
- [ ] UI doesn't break
- [ ] User can retry

#### 8.2 Kiosk Out of SONAR

1. Drain kiosk reserve (set to 0 via admin)
2. Try to purchase

**Expected**:
- [ ] Error: "Kiosk out of SONAR"
- [ ] Fallback UI suggests marketplace purchase
- [ ] Monitoring dashboard shows critical alert

#### 8.3 Backend Offline

1. Stop backend server
2. Try to load marketplace

**Expected**:
- [ ] Frontend shows warning banner
- [ ] "Backend unavailable" message
- [ ] Marketplace still browsable (blockchain data)
- [ ] Purchase buttons disabled

#### 8.4 RPC Failure

1. Set invalid SUI_RPC_URL in backend
2. Restart backend
3. Try to purchase

**Expected**:
- [ ] Error logged in backend
- [ ] User sees "Network error"
- [ ] Transaction doesn't submit
- [ ] No partial state

---

## Success Criteria

✅ **All tests must pass**:

- [ ] Backend health checks pass
- [ ] Kiosk price API returns correct data
- [ ] Monitoring endpoints functional
- [ ] Frontend marketplace loads datasets
- [ ] Preview playback works from Walrus
- [ ] Two-step purchase flow completes successfully
- [ ] One-step purchase flow completes successfully
- [ ] Backend records purchases correctly
- [ ] Idempotency prevents duplicates
- [ ] Kiosk reserves update correctly
- [ ] Monitoring dashboard displays accurate metrics
- [ ] Error cases handled gracefully
- [ ] No console errors (except expected ones)
- [ ] All BigInt calculations precise (no rounding errors)

---

## Post-Test Cleanup

After completing smoke test:

```bash
# 1. Document any failures in GitHub issues

# 2. Reset database if needed
cd backend
bun prisma migrate reset --force

# 3. Refund test wallets (optional)
# Transfer remaining SUI back to faucet or personal wallet

# 4. Archive test transaction digests
# Save tx hashes for reference in docs/test-results/smoke-test-YYYY-MM-DD.md
```

---

## Test Results Template

Copy this template to `docs/test-results/smoke-test-YYYY-MM-DD.md`:

```markdown
# Smoke Test Results - YYYY-MM-DD

## Environment
- Sui Network: Testnet
- Backend Version: vX.Y.Z
- Frontend Version: vX.Y.Z
- Tester: [Your Name]

## Test Summary
- Total Tests: 8
- Passed: __
- Failed: __
- Duration: __ hours

## Failed Tests
[List any failures with details]

## Issues Found
[Create GitHub issues and link here]

## Transaction Digests
- Wallet 1 Buy SONAR: `0x...`
- Wallet 1 Buy Dataset: `0x...`
- Wallet 2 Buy Dataset: `0x...`

## Notes
[Any observations, performance issues, or recommendations]
```

---

## Troubleshooting

### Common Issues

**"Cannot connect to database"**
```bash
# Start PostgreSQL
brew services start postgresql@14

# Check if running
psql -U postgres -c "SELECT 1"
```

**"Kiosk price returns 0"**
- Check kiosk is funded: `./scripts/kiosk-admin.sh status`
- Verify MARKETPLACE_ID in backend .env

**"Preview audio doesn't load"**
- Verify Walrus blob IDs in dataset seed data
- Check WALRUS_AGGREGATOR_URL is correct
- Test direct fetch: `curl https://aggregator.walrus-testnet.walrus.space/v1/blobs/<BLOB_ID>`

**"Transaction rejected"**
- Check wallet has enough gas (≥0.1 SUI)
- Verify contract deployed and PACKAGE_ID correct
- Check marketplace object created

**"Access denied after purchase"**
- Check backend event listener is running
- Verify tx digest in KioskPurchase table
- Check access_log for errors

---

## Next Steps

After successful smoke test:

1. **Run Integration Tests**
   ```bash
   cd backend
   bun test src/__tests__/kiosk.test.ts
   ```

2. **Run E2E Tests**
   ```bash
   cd frontend
   bun playwright test e2e/kiosk-purchase.spec.ts
   ```

3. **Deploy to Testnet**
   - Follow `docs/DEPLOYMENT.md`
   - Update production environment variables
   - Run smoke test again on deployed environment

4. **Prepare for Mainnet**
   - Security audit of smart contracts
   - Load testing
   - Disaster recovery plan
   - Monitoring alerts configured

---

## References

- **API Documentation**: `docs/API.md`
- **Deployment Guide**: `docs/DEPLOYMENT.md`
- **E2E Testing**: `docs/E2E_TESTING.md`
- **Walrus Upload**: `docs/WALRUS_UPLOAD_GUIDE.md`
- **Monitoring**: `docs/KIOSK_MONITORING.md`
- **Kiosk Admin**: `scripts/kiosk-admin.sh`
