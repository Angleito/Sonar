# SONAR Protocol - Walrus Integration Guide

## Overview

SONAR Protocol integrates with **Walrus** for decentralized blob storage and **Mysten Seal** for threshold encryption. This document describes the integration architecture, on-chain metadata patterns, and operational flows.

**Key Principle**: SONAR smart contracts store only **metadata references** to Walrus blobs. The contracts never manage storage, encryption keys, or blob content directly.

## Architecture

```
┌──────────────┐
│ SONAR Client │ (Browser/Mobile)
└──────┬───────┘
       │ 1. Record audio
       │ 2. Encrypt with Seal (client-side)
       │ 3. Upload to Walrus
       ▼
┌────────────────┐
│ Walrus Storage │ (Decentralized blob network)
└────────┬───────┘
         │ Returns: blob_id
         ▼
    ┌────────────┐
    │ Backend    │ (Validation service)
    └─────┬──────┘
          │ 4. LLM quality check
          │ 5. Store metadata on-chain
          ▼
    ┌──────────────┐
    │ Sui Contract │ (SONAR marketplace)
    │  - seal_policy_id
    │  - preview_hash
    │  - NO blob_id in events
    └──────────────┘
```

## On-Chain Metadata (What SONAR Stores)

SONAR contracts store minimal Walrus-related metadata:

```move
struct AudioSubmission has key, store {
    id: UID,
    uploader: address,

    // Walrus/Seal metadata (ONLY these fields)
    seal_policy_id: String,              // Mysten Seal policy ID for decryption
    preview_blob_hash: Option<vector<u8>>, // Optional: hash for preview/verification

    // SONAR-specific fields
    duration_seconds: u64,
    quality_score: u8,
    vested_balance: VestedBalance,
    unlocked_balance: u64,
    dataset_price: u64,
    listed_for_sale: bool,
    purchase_count: u64,
    status: u8,
    submitted_at: u64
}
```

### What's Included
- ✅ `seal_policy_id`: Used by buyers to request decryption shares from Seal network
- ✅ `preview_blob_hash`: Optional hash of preview/thumbnail for verification (NOT the full blob ID)

### What's Excluded
- ❌ `walrus_blob_id`: Never stored on-chain or emitted in events (privacy)
- ❌ Storage epoch info: Managed by Walrus, not SONAR
- ❌ Encryption keys: Managed by Seal, not SONAR
- ❌ Blob content: Stored in Walrus, not on-chain

## Walrus Package References

### Testnet

| Component | Package ID | Source |
|-----------|------------|--------|
| **Walrus System** | `0x261b2e46428a152570f9ac08972d67f7c12d62469ccd381a51774c1df7a829ca` | From Move.lock (version 3) |
| **WAL Token** | TBD | Local dependency |
| **Walrus Staking** | TBD | Referenced in docs |

### Mainnet

| Component | Package ID | Source |
|-----------|------------|--------|
| **Walrus System** | TBD | To be captured at mainnet launch |
| **WAL Token** | TBD | To be captured at mainnet launch |

## Walrus Operational Flows

### 1. Submission Flow (Audio Upload)

**Off-Chain Steps (Client + Backend)**:
1. User records audio in browser
2. Client generates encryption key locally
3. Client encrypts audio with **Mysten Seal** (client-side)
4. Client uploads encrypted blob to **Walrus Storage**
5. Walrus returns `blob_id` (64-byte hash)
6. Client sends `blob_id` + `seal_policy_id` to backend
7. Backend validates audio quality (LLM)
8. Backend generates preview hash (optional)

**On-Chain Steps (Smart Contract)**:
```move
// User calls submit_audio
public entry fun submit_audio(
    marketplace: &mut QualityMarketplace,
    burn_fee: Coin<SONAR>,
    seal_policy_id: String,           // From Seal encryption
    preview_blob_hash: Option<vector<u8>>, // Optional hash
    duration_seconds: u64,
    ctx: &mut TxContext
)
```

**What's NOT on-chain**: The actual `blob_id` from Walrus. The backend stores this in its own database, associated with the submission object ID.

### 2. Purchase Flow (Data Access)

**On-Chain Steps**:
1. Buyer calls `purchase_dataset(submission_id, payment)`
2. Contract executes payment splits (burn/liquidity/uploader/treasury)
3. Contract emits `DatasetPurchased` event with `seal_policy_id`
4. Contract updates submission `purchase_count`

**Off-Chain Steps (Backend)**:
1. Backend detects `DatasetPurchased` event
2. Backend verifies buyer address and payment
3. Backend looks up `blob_id` from its database (using submission_id)
4. Backend requests **decryption shares** from Seal network for buyer
5. Backend returns to buyer:
   - Walrus aggregator URL
   - `blob_id` (NOT from blockchain, from backend database)
   - Seal decryption shares
   - Access credentials

**Buyer Downloads**:
```bash
# Buyer receives from backend API (authenticated)
BLOB_ID="Axe8...64bytes"
AGGREGATOR="https://aggregator.walrus-testnet.walrus.space/v1"

# Download encrypted blob
curl ${AGGREGATOR}/${BLOB_ID} -o encrypted_audio.blob

# Decrypt with Seal shares (client-side)
seal decrypt encrypted_audio.blob --shares decryption_shares.json -o audio.wav
```

### 3. Seal Threshold Encryption Flow

**Encryption (Uploader)**:
```bash
# Client-side (browser or CLI)
seal encrypt audio.wav --policy-id NEW_POLICY_ID -o encrypted.blob

# Returns:
# - encrypted.blob (upload to Walrus)
# - policy_id (store on-chain)
# - shares (distributed to Seal validators)
```

**Decryption (Buyer)**:
```bash
# Backend requests shares from Seal network
seal request-shares \
  --policy-id POLICY_ID \
  --requester BUYER_ADDRESS \
  --proof-of-purchase SUBMISSION_ID

# Returns: decryption shares (threshold: 2-of-3, 3-of-5, etc.)

# Buyer combines shares to decrypt
seal decrypt encrypted.blob --shares shares.json -o audio.wav
```

## Walrus Faucet & Resources

### Testnet Faucet

SONAR contracts don't require WAL tokens directly, but deployers and testers may need WAL for:
- Testing Walrus storage integration (backend)
- Exploring Walrus explorer
- Understanding WAL staking mechanics

**Faucet URL**: https://faucet.walrus-testnet.walrus.space

**Request WAL**:
```bash
curl -X POST https://faucet.walrus-testnet.walrus.space/request \
  -H "Content-Type: application/json" \
  -d '{"address": "0x...YOUR_SUI_ADDRESS"}'
```

**Response**:
```json
{
  "success": true,
  "amount": "10000000000",  // 10 WAL (9 decimals)
  "tx_digest": "Abc123..."
}
```

### Walrus Explorer

**Testnet Explorer**: https://explorer.walrus-testnet.walrus.space

**What you can verify**:
- WAL package deployments
- Storage epochs
- Staking information
- System parameters

**What you CANNOT verify**:
- Individual blob IDs (privacy by design)
- Seal policy IDs
- SONAR submission blob IDs (intentionally excluded)

## Integration Checklist

### For Smart Contract Development ✅

- [x] Vendor Walrus/WAL Move packages
- [x] Add Walrus dependency to Move.toml
- [x] Define metadata fields in AudioSubmission
- [x] Ensure NO blob_id in events
- [x] Include seal_policy_id in purchase events
- [ ] Test compilation with WAL types
- [ ] Verify no WAL-specific logic in contracts

### For Backend Service Development 🔄

- [ ] Implement Walrus blob upload API
- [ ] Implement Seal encryption/decryption
- [ ] Store blob_id in backend database (NOT on-chain)
- [ ] Map submission_id → blob_id
- [ ] Implement decryption share distribution
- [ ] Verify purchase on-chain before granting access
- [ ] Rate limit decryption requests
- [ ] Monitor Walrus storage epochs

### For Frontend Development 🔄

- [ ] Integrate Seal encryption library (client-side)
- [ ] Implement audio recording UI
- [ ] Implement Walrus upload flow
- [ ] Display Seal policy ID in submission details
- [ ] Implement authenticated download flow for purchases
- [ ] Implement client-side decryption
- [ ] Handle Walrus network errors gracefully

## Security Considerations

### Why NO Blob ID On-Chain?

**Privacy**: Exposing blob IDs in public blockchain events would allow anyone to attempt downloading blobs from Walrus, even if encrypted. By keeping blob IDs off-chain:
1. Only authenticated purchasers receive blob IDs
2. Reduces attack surface for storage network
3. Provides additional layer of access control
4. Complies with privacy-first architecture

### Seal Policy Access Control

The `seal_policy_id` is public because:
1. It's required for buyers to request decryption shares
2. Seal network enforces access control via cryptographic proofs
3. Having the policy ID doesn't grant decryption access
4. Shares are only issued to verified purchasers

### Backend Database Security

Since `blob_id` is stored off-chain:
- Backend database becomes a critical security component
- Must implement:
  - Encrypted at rest
  - Access logging
  - Regular backups
  - Intrusion detection
- Loss of database = loss of blob ID mappings (plan disaster recovery)

## Troubleshooting

### Build Error: WAL Dependency Not Found
```
Error: Could not find dependency 'Walrus' in local path
```

**Solution**:
```bash
cd contracts
ls -la dependencies/  # Verify walrus/ and wal/ directories exist
sui move build --skip-fetch-latest-git-deps
```

### Runtime Error: Seal Policy ID Not Found
```
Error: Seal policy not found for submission
```

**Cause**: Backend didn't store Seal policy ID correctly during submission

**Solution**:
1. Verify backend stores `seal_policy_id` from client
2. Check backend logs for encryption step
3. Verify Seal network connectivity

### Purchase Error: Cannot Download Blob
```
Error: Blob ID not found in backend database
```

**Cause**: Backend database lost blob_id mapping

**Solution**:
1. Check backend database integrity
2. Restore from backup
3. Re-upload blob if uploader still has original

## Future Enhancements

### Potential Improvements (Not Currently Implemented)

1. **Blob Verification Hash**: Store hash of encrypted blob on-chain for verification
2. **Storage Epoch Tracking**: Track Walrus storage renewal epochs
3. **Multi-Blob Submissions**: Support datasets with multiple audio files
4. **Partial Decryption**: Allow preview access without full decryption
5. **Cross-Chain Walrus**: Integrate with Walrus on other chains

## Resources

### Documentation
- Walrus Docs: https://docs.walrus.site
- Mysten Seal Docs: https://docs.seal.mystenlabs.com
- Sui Move Book: https://examples.sui.io/basics/init.html

### Repositories
- Walrus Contracts: https://github.com/MystenLabs/walrus-docs/tree/main/contracts
- SONAR Protocol: https://github.com/sonar-protocol/sonar

### Community
- Walrus Discord: #walrus-testnet
- Sui Discord: #move-lang
- SONAR Discord: discord.gg/sonar (TBD)

## Contact

For Walrus integration questions:
- **Technical**: tech@sonar.xyz
- **Architecture**: ops@sonar.xyz
- **Security**: security@sonar.xyz
