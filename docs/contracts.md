# SONAR Protocol - Smart Contract Specification

**Status**: Locked for Implementation
**Version**: 1.0
**Date**: 2025-10-28

## Overview

This document serves as the definitive specification for SONAR Protocol smart contracts. All implementation must strictly adhere to the values, thresholds, and patterns defined here.

## Token Specifications

### SONAR Token

| Property | Value | Notes |
|----------|-------|-------|
| **Name** | SONAR Token | Full name |
| **Symbol** | SONAR | Ticker symbol |
| **Decimals** | 9 | Standard Sui token decimals |
| **Total Supply** | 100,000,000 SONAR | Fixed, non-mintable after init |
| **Total Supply (base units)** | 100,000,000,000,000,000 | 100M × 10^9 |
| **Type** | `Coin<SONAR>` | Sui fungible token |

### Initial Distribution

| Allocation | Amount (SONAR) | Amount (base units) | Recipient | Vesting |
|------------|----------------|---------------------|-----------|---------|
| **Reward Pool** | 70,000,000 | 70,000,000,000,000,000 | Marketplace contract | No vesting |
| **Team** | 30,000,000 | 30,000,000,000,000,000 | Team wallet | 24mo, 6mo cliff (off-chain) |

**Critical**: The initialization function MUST execute this split explicitly:
```move
let total = coin::mint(&mut treasury_cap, 100_000_000_000_000_000, ctx);
let reward_coins = coin::split(&mut total, 70_000_000_000_000_000, ctx);
let team_coins = total; // Remaining 30M
```

## Economic Tiers (Absolute Thresholds)

### Tier Definitions

| Tier | Name | Circulating Supply Range | Burn Rate | Liquidity | Uploader | Treasury |
|------|------|--------------------------|-----------|-----------|----------|----------|
| **1** | Early Phase | >50,000,000 SONAR | 60% | 0% | 30% | 10% |
| **2** | Growth Phase | 35,000,000 - 50,000,000 | 45% | 10% | 35% | 10% |
| **3** | Mature Phase | 20,000,000 - 35,000,000 | 30% | 15% | 45% | 10% |
| **4** | Conservation | <20,000,000 SONAR | 20% | 20% | 50% | 10% |

### Threshold Values (Base Units)

**CRITICAL**: These are ABSOLUTE token counts, NOT percentages. Used for direct comparison to prevent u64 overflow.

| Threshold | Base Units | Display Value | Comparison |
|-----------|------------|---------------|------------|
| **tier_1_floor** | 50,000,000,000,000,000 | 50,000,000 SONAR | if (circulating > tier_1_floor) → Tier 1 |
| **tier_2_floor** | 35,000,000,000,000,000 | 35,000,000 SONAR | if (circulating > tier_2_floor) → Tier 2 |
| **tier_3_floor** | 20,000,000,000,000,000 | 20,000,000 SONAR | if (circulating > tier_3_floor) → Tier 3 |
| **Below tier_3** | <20,000,000,000,000,000 | <20,000,000 SONAR | else → Tier 4 |

### Basis Points (BPS) Configuration

All rates use **basis points** (1 BPS = 0.01%, 10000 BPS = 100%):

```move
struct EconomicConfig has store {
    // Tier thresholds (absolute base units)
    tier_1_floor: u64,           // 50,000,000,000,000,000
    tier_2_floor: u64,           // 35,000,000,000,000,000
    tier_3_floor: u64,           // 20,000,000,000,000,000

    // Burn rates per tier (basis points)
    tier_1_burn_bps: u64,        // 6000 = 60%
    tier_2_burn_bps: u64,        // 4500 = 45%
    tier_3_burn_bps: u64,        // 3000 = 30%
    tier_4_burn_bps: u64,        // 2000 = 20%

    // Liquidity allocation per tier (basis points)
    tier_1_liquidity_bps: u64,   // 0    = 0%
    tier_2_liquidity_bps: u64,   // 1000 = 10%
    tier_3_liquidity_bps: u64,   // 1500 = 15%
    tier_4_liquidity_bps: u64,   // 2000 = 20%

    // Treasury (constant across all tiers)
    treasury_bps: u64,           // 1000 = 10%
}
```

**Invariant**: For any purchase, the sum MUST equal 10000 BPS (100%):
```move
burn_bps + liquidity_bps + uploader_bps + treasury_bps == 10000
```

## Circulating Supply Calculation

### Formula

```move
public fun get_circulating_supply(marketplace: &QualityMarketplace): u64 {
    let total = coin::total_supply(&marketplace.treasury_cap);
    let escrowed = balance::value(&marketplace.reward_pool)
                 + balance::value(&marketplace.liquidity_vault);

    if (total > escrowed) {
        total - escrowed
    } else {
        0  // Safety check
    }
}
```

### Components

| Component | Included in Circulating? | Reason |
|-----------|-------------------------|--------|
| **Total Supply** | ✅ Starting point | Decreases with burns |
| **Reward Pool** | ❌ Subtracted | Locked in contract, not yet earned |
| **Liquidity Vault** | ❌ Subtracted | Locked for AMM deployment |
| **Team Allocation** | ✅ Counted | Transferred at init, not held in contract |
| **Vested User Balances** | ✅ Counted | Will unlock predictably over 90 days |

**Rationale**: Team allocation is conservatively counted as circulating because it was transferred out of the contract at initialization. Vested balances are counted because they will unlock over time.

## Submission Economics

### Burn Fee (Anti-Spam)

**Formula**: 0.001% of circulating supply

```move
let burn_fee = (circulating_supply * 1) / 100_000;
```

**Examples**:
- Circulating: 70M → Fee: 700 SONAR
- Circulating: 50M → Fee: 500 SONAR
- Circulating: 30M → Fee: 300 SONAR

### Quality-Based Rewards

| Quality Score | Reward % of Circulating | Initial Amount (70M circ) | Tier |
|---------------|-------------------------|---------------------------|------|
| 0-29 | 0% | 0 SONAR | Rejected |
| 30-49 | 0.001% | 700 SONAR | Low |
| 50-69 | 0.0025% | 1,750 SONAR | Medium |
| 70-89 | 0.004% | 2,800 SONAR | High |
| 90-100 | 0.005% | 3,500 SONAR | Excellent |

**Reward Calculation**:
```move
public fun calculate_reward(circulating: u64, quality_score: u8): u64 {
    if (quality_score < 30) {
        0  // Rejected
    } else if (quality_score < 50) {
        (circulating * 1) / 100_000    // 0.001%
    } else if (quality_score < 70) {
        (circulating * 25) / 1_000_000  // 0.0025%
    } else if (quality_score < 90) {
        (circulating * 4) / 100_000     // 0.004%
    } else {
        (circulating * 5) / 100_000     // 0.005%
    }
}
```

### Vesting Schedule

**All earned tokens vest linearly over 90 days (epochs)**:

```move
struct VestedBalance has store {
    total_amount: u64,              // Total tokens earned
    unlock_start_epoch: u64,        // Epoch when vesting started
    unlock_duration_epochs: u64,    // 90 epochs (~90 days on Sui)
    claimed_amount: u64             // Tokens already claimed
}
```

**Unlocked Amount Calculation**:
```move
public fun calculate_unlocked_amount(vested: &VestedBalance, current_epoch: u64): u64 {
    let elapsed = current_epoch - vested.unlock_start_epoch;

    if (elapsed >= vested.unlock_duration_epochs) {
        // Fully vested
        vested.total_amount - vested.claimed_amount
    } else {
        // Partial: (total * elapsed) / duration
        let unlockable = (vested.total_amount * elapsed) / vested.unlock_duration_epochs;
        if (unlockable > vested.claimed_amount) {
            unlockable - vested.claimed_amount
        } else {
            0
        }
    }
}
```

### Reward Pool Guard

**CRITICAL**: Before accepting submissions, check that the reward pool can cover the minimum reward:

```move
// In submit_audio:
let min_reward = calculate_reward(circulating, 30);  // Lowest quality accepted
assert!(
    balance::value(&marketplace.reward_pool) >= min_reward,
    E_REWARD_POOL_DEPLETED
);
```

## Circuit Breaker

### Configuration

```move
struct CircuitBreaker has store {
    enabled: bool,                  // Is breaker currently active?
    triggered_at_epoch: u64,        // When was it activated?
    trigger_reason: String,         // Why was it activated?
    cooldown_epochs: u64            // Minimum 24 epochs (~24 hours)
}
```

### Enforcement

**ALL mutable entrypoints MUST check**:
```move
assert!(
    !is_circuit_breaker_active(&marketplace.circuit_breaker, ctx),
    E_CIRCUIT_BREAKER_ACTIVE
);
```

**Gated functions**:
- `purchase_dataset`
- `withdraw_liquidity_vault`
- `deploy_liquidity_to_amm`
- `list_dataset` (if implemented)
- `unlist_dataset` (if implemented)

**NOT gated** (always available):
- `submit_audio` (users can still submit)
- `claim_vested_tokens` (users can access earned tokens)
- View functions (read-only)

### Activation/Deactivation

```move
// Activate (AdminCap required)
public entry fun activate_circuit_breaker(
    _cap: &AdminCap,
    marketplace: &mut QualityMarketplace,
    reason: String,
    ctx: &TxContext
)

// Deactivate (AdminCap required, cooldown must pass)
public entry fun deactivate_circuit_breaker(
    _cap: &AdminCap,
    marketplace: &mut QualityMarketplace,
    ctx: &TxContext
)
```

## Liquidity Vault Withdrawal Limits

### Configuration

```move
struct WithdrawalLimits has store {
    max_per_epoch_bps: u64,        // 1000 = 10% max per epoch
    min_epochs_between: u64,       // 7 epochs minimum
    last_withdrawal_epoch: u64,    // Track last withdrawal
    total_withdrawn_this_epoch: u64 // Track amount this epoch
}
```

### Enforcement

```move
// In withdraw_liquidity_vault:
let vault_balance = balance::value(&marketplace.liquidity_vault);
let max_this_epoch = (vault_balance * limits.max_per_epoch_bps) / 10_000;

assert!(
    current_epoch >= limits.last_withdrawal_epoch + limits.min_epochs_between,
    E_WITHDRAWAL_TOO_FREQUENT
);

assert!(amount <= max_this_epoch, E_WITHDRAWAL_EXCEEDS_LIMIT);
```

## Capability Custody

### AdminCap

**Purpose**: Control critical protocol functions

**Holder**: Multisig wallet (2-of-3 recommended)

**Powers**:
- Update economic config (tier thresholds, rates)
- Withdraw from liquidity vault (with limits)
- Deploy liquidity to AMM
- Activate/deactivate circuit breaker
- Future: Burned after protocol maturity (12-24 months)

**Initial Holder**: Deployer (rotated to multisig in Phase 6)

### ValidatorCap

**Purpose**: Finalize audio submissions after quality check

**Holder**: Backend validator service

**Powers**:
- Finalize submissions (set quality score, approve/reject)
- Trigger reward distribution from pool

**Initial Holder**: Deployer (transferred to backend in Phase 6)

### Team Wallet

**Purpose**: Receive 30M SONAR team allocation

**Holder**: Team vesting contract or multisig

**Vesting**: 24 months with 6-month cliff (managed off-chain)

**Address**: To be specified in deployment scripts

## Event Schemas

### SubmissionCreated

```move
struct SubmissionCreated has copy, drop {
    submission_id: ID,
    uploader: address,
    seal_policy_id: String,        // ✅ Safe to emit
    duration_seconds: u64,
    burn_fee_paid: u64,
    submitted_at_epoch: u64
}
```

**CRITICAL**: NO `walrus_blob_id` field. Blob IDs are kept off-chain for privacy.

### SubmissionFinalized

```move
struct SubmissionFinalized has copy, drop {
    submission_id: ID,
    quality_score: u8,
    status: u8,                    // 1=approved, 2=rejected
    reward_amount: u64,
    vesting_start_epoch: u64,
    vesting_duration_epochs: u64
}
```

### DatasetPurchased

```move
struct DatasetPurchased has copy, drop {
    submission_id: ID,
    buyer: address,
    price: u64,

    // Dynamic economics (tier-based)
    burned: u64,
    burn_rate_bps: u64,
    liquidity_allocated: u64,
    liquidity_rate_bps: u64,
    uploader_paid: u64,
    uploader_rate_bps: u64,
    treasury_paid: u64,

    // Supply metrics
    circulating_supply: u64,
    economic_tier: u8,              // 1, 2, 3, or 4

    // Walrus integration
    seal_policy_id: String,         // ✅ For decryption request
    // NO walrus_blob_id!

    purchase_timestamp: u64
}
```

### CircuitBreakerActivated / Deactivated

```move
struct CircuitBreakerActivated has copy, drop {
    reason: String,
    triggered_at_epoch: u64,
    cooldown_epochs: u64
}

struct CircuitBreakerDeactivated has copy, drop {
    deactivated_at_epoch: u64
}
```

### LiquidityVaultWithdrawal

```move
struct LiquidityVaultWithdrawal has copy, drop {
    amount: u64,
    recipient: address,
    reason: String,
    remaining_balance: u64,
    withdrawn_by: address,
    timestamp_epoch: u64
}
```

## Test Requirements

### Boundary Tests (MANDATORY)

All three tier boundaries MUST be tested explicitly:

```move
// Tier 1/2 boundary
#[test]
fun test_tier_boundary_50M_above() {
    let circ = 50_000_000_000_000_001;  // Just above
    assert!(get_tier(circ, &config) == 1, E_WRONG_TIER);
}

#[test]
fun test_tier_boundary_50M_at() {
    let circ = 50_000_000_000_000_000;  // Exactly at
    assert!(get_tier(circ, &config) == 2, E_WRONG_TIER);
}

// Tier 2/3 boundary
#[test]
fun test_tier_boundary_35M_above() {
    let circ = 35_000_000_000_000_001;
    assert!(get_tier(circ, &config) == 2, E_WRONG_TIER);
}

#[test]
fun test_tier_boundary_35M_at() {
    let circ = 35_000_000_000_000_000;
    assert!(get_tier(circ, &config) == 3, E_WRONG_TIER);
}

// Tier 3/4 boundary
#[test]
fun test_tier_boundary_20M_above() {
    let circ = 20_000_000_000_000_001;
    assert!(get_tier(circ, &config) == 3, E_WRONG_TIER);
}

#[test]
fun test_tier_boundary_20M_at() {
    let circ = 20_000_000_000_000_000;
    assert!(get_tier(circ, &config) == 4, E_WRONG_TIER);
}
```

### Integration Tests

```move
#[test]
fun test_mid_run_tier_transition() {
    // Start in Tier 2 (40M circulating)
    // Execute purchase → burns 45%
    // Check if crossed into Tier 3
    // Verify next purchase uses 30% burn
}
```

### Negative Tests

```move
#[test]
#[expected_failure(abort_code = E_REWARD_POOL_DEPLETED)]
fun test_submission_rejected_when_pool_dry() {
    // Drain reward pool
    // Attempt submission
    // Should abort
}

#[test]
#[expected_failure(abort_code = E_CIRCUIT_BREAKER_ACTIVE)]
fun test_purchase_blocked_by_breaker() {
    // Activate circuit breaker
    // Attempt purchase
    // Should abort
}
```

## Error Codes

```move
// Token errors (1000-1999)
const E_INVALID_AMOUNT: u64 = 1001;
const E_INSUFFICIENT_BALANCE: u64 = 1002;

// Submission errors (2000-2999)
const E_INVALID_BURN_FEE: u64 = 2001;
const E_REWARD_POOL_DEPLETED: u64 = 2002;
const E_ALREADY_FINALIZED: u64 = 2003;
const E_INVALID_QUALITY_SCORE: u64 = 2004;

// Purchase errors (3000-3999)
const E_NOT_LISTED: u64 = 3001;
const E_NOT_APPROVED: u64 = 3002;
const E_INVALID_PAYMENT: u64 = 3003;

// Economics errors (4000-4999)
const E_INVALID_TIER: u64 = 4001;
const E_INVALID_BPS: u64 = 4002;

// Admin errors (5000-5999)
const E_UNAUTHORIZED: u64 = 5001;
const E_CIRCUIT_BREAKER_ACTIVE: u64 = 5002;
const E_COOLDOWN_NOT_ELAPSED: u64 = 5003;
const E_WITHDRAWAL_TOO_FREQUENT: u64 = 5004;
const E_WITHDRAWAL_EXCEEDS_LIMIT: u64 = 5005;

// Vesting errors (6000-6999)
const E_NOTHING_TO_CLAIM: u64 = 6001;
const E_NOT_VESTED_YET: u64 = 6002;
```

## Addresses & Recipients

### Deployment Configuration

To be specified in deployment scripts (`deployments/testnet.json`):

```json
{
    "team_wallet": "0x...TO_BE_SPECIFIED",
    "admin_multisig": "0x...TO_BE_SPECIFIED",
    "backend_validator": "0x...TO_BE_SPECIFIED",
    "treasury": "0x...TO_BE_SPECIFIED"
}
```

### Mainnet Configuration

```json
{
    "team_wallet": "0x...TO_BE_SPECIFIED",
    "admin_multisig": "0x...TO_BE_SPECIFIED",
    "backend_validator": "0x...TO_BE_SPECIFIED",
    "treasury": "0x...TO_BE_SPECIFIED"
}
```

## Implementation Checklist

- [ ] Token supply constants match specification
- [ ] Tier thresholds use EXACT base unit values
- [ ] Circulating supply calculation correct
- [ ] All BPS calculations sum to 10000
- [ ] Reward pool guards in place
- [ ] Circuit breaker checks in ALL mutable functions
- [ ] Withdrawal limits enforced
- [ ] All events exclude blob IDs
- [ ] All events include seal_policy_id
- [ ] Boundary tests for all three thresholds
- [ ] Integration test for mid-run tier transition
- [ ] Negative tests for pool depletion and circuit breaker
- [ ] Move Prover specs written and passing
- [ ] Capability custody documented

## Modification Protocol

**This specification is LOCKED for implementation.**

Any changes to:
- Token supply
- Tier thresholds
- BPS rates
- Event schemas
- Capability powers

Must be:
1. Documented in this file with rationale
2. Approved by all stakeholders
3. Tested thoroughly
4. Communicated to team

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-10-28 | Initial locked specification | SONAR Team |

---

**This document is the source of truth for smart contract implementation. All code MUST match these specifications exactly.**
