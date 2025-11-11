# SNR Tokenomics – MVP Hackathon Plan

**Status**: Draft for Implementation  
**Version**: 0.3  
**Date**: 2025-11-11

## Overview

This document captures the working tokenomics plan for the SNR token while we are in MVP hackathon mode. The goal is to codify the decisions we have agreement on (total supply, launch allocations, deflation mechanics) and highlight the open questions that must be resolved before we freeze a production-ready specification. All code written for the MVP should stay within the values and formulas defined here.

> ⚠️ **Draft Notice**  
> Numbers, vesting schedules, and recipients are still subject to change. When something is marked “TBD” it must be confirmed with the stakeholders before mainnet deployment.

## Token Specification

| Property | Value | Notes |
|----------|-------|-------|
| **Name** | SNR Token | Working name until brand sign-off |
| **Symbol** | SNR | |
| **Decimals** | 9 | Matches Sui standard token decimals |
| **Total Supply** | 100,000,000 SNR | Hard-capped, minted once at init |
| **Total Supply (base units)** | 100,000,000,000,000,000 | `100_000_000 × 10^9` |
| **Type** | `Coin<SNR>` | Sui fungible token implementation |

### Base Unit Helpers

| Display | Base Units |
|---------|------------|
| 1 SNR | 1,000,000,000 |
| 10,000 SNR | 10,000,000,000,000 |
| 1,000,000 SNR | 1,000,000,000,000,000 |
| 10,000,000 SNR | 10,000,000,000,000,000 |

## Mint & Allocation Plan

All 100M SNR are minted in the initializer and split immediately into the buckets below. Exact addresses remain TBD but must be multisig controlled.

| Allocation | Amount (SNR) | Base Units | Unlock / Vesting | Notes |
|------------|--------------|------------|------------------|-------|
| **Launch Liquidity** | 20,000,000 | 20,000,000,000,000,000 | Liquid at TGE | Seed DEX pools, incentives, market making |
| **Launchpad & Community Sale** | 10,000,000 | 10,000,000,000,000,000 | Liquid at TGE | Sold / distributed to early users |
| **Contributor Incentive Reserve** | 40,000,000 | 40,000,000,000,000,000 | Locked on-chain, streamed via marketplace | Pays creators / uploaders from protocol controlled reserve while volume ramps |
| **Team & Advisor Vesting** | 15,000,000 | 15,000,000,000,000,000 | 24mo linear, 6mo cliff (off-chain legal wrapper) | Moves to multisig on TGE, vesting executed off-chain |
| **Treasury & Strategic Partnerships** | 15,000,000 | 15,000,000,000,000,000 | 36mo linear, quarterly unlocks (TBD) | Used for grants, BD, and emergency runway |

**Initializer Split**

```move
let total = coin::mint(&mut treasury_cap, 100_000_000_000_000_000, ctx);
let launch_liquidity = coin::split(&mut total, 20_000_000_000_000_000, ctx);
let launchpad_sale = coin::split(&mut total, 10_000_000_000_000_000, ctx);
let contributor_reserve = coin::split(&mut total, 40_000_000_000_000_000, ctx);
let team_reserve = coin::split(&mut total, 15_000_000_000_000_000, ctx);
let treasury_reserve = total; // Remaining 15M
```

Assignments:

- `launch_liquidity` ➜ DEX multisig
- `launchpad_sale` ➜ Distribution contract
- `contributor_reserve` ➜ `marketplace.reward_pool`
- `team_reserve` ➜ Team vesting custodian (off-chain schedule)
- `treasury_reserve` ➜ Treasury multisig (time-lock, TBD)

## Circulating Supply Tracking

Initial circulating float at launch is expected to be 30M SNR (20M liquidity + 10M launchpad). Lockups (team, treasury, unspent incentive reserve) remain outside the liquid float but **the burn tiers key off of remaining total supply, not circulating supply**.

Recommended helper:

```move
public fun get_circulating_supply(state: &MarketplaceState): u64 {
    let total = coin::total_supply(&state.treasury_cap);
    let locked = balance::value(&state.contributor_reserve)
               + balance::value(&state.team_vault)
               + balance::value(&state.treasury_vault);
    if (total > locked) total - locked else 0
}
```

| Component | Included in `circulating`? | Rationale |
|-----------|---------------------------|-----------|
| Launch liquidity wallets | ✅ | Actively traded |
| Launchpad distribution | ✅ | In user hands |
| Contributor reserve | ❌ | Locked until earned |
| Team vesting | ❌ | Subject to cliffs |
| Treasury reserve | ❌ | Strategic / emergency only |

## Dynamic Burn Tiers (Absolute Supply Floors)

The protocol burns aggressively while supply is high, then tapers to keep the token usable.

| Tier | Remaining Total Supply (base units) | Display Range | Burn BPS | Contributor BPS | Condition |
|------|-------------------------------------|---------------|----------|-----------------|-----------|
| **1 – Genesis Deflation** | `> 60_000_000_000_000_000` | (60M, 100M] SNR | 6000 (60%) | 4000 (40%) | Default at launch |
| **2 – Growth** | `> 40_000_000_000_000_000` and `≤ 60_000_000_000_000_000` | (40M, 60M] | 4000 (40%) | 6000 (60%) | Triggered once 40M supply has been burned |
| **3 – Sustainability** | `≤ 40_000_000_000_000_000` | 0 – 40M | 2000 (20%) | 8000 (80%) | Floor tier; no further reductions |

**Config Struct**

```move
struct BurnConfig has store {
    tier_2_floor: u64,              // 60_000_000_000_000_000
    tier_3_floor: u64,              // 40_000_000_000_000_000

    tier_1_burn_bps: u64,           // 6000
    tier_1_contributor_bps: u64,    // 4000

    tier_2_burn_bps: u64,           // 4000
    tier_2_contributor_bps: u64,    // 6000

    tier_3_burn_bps: u64,           // 2000
    tier_3_contributor_bps: u64,    // 8000
}
```

**Invariant**

```move
burn_bps + contributor_bps == 10_000 // 100%
```

**Tier Lookup**

```move
public fun get_burn_tier(supply_remaining: u64, cfg: &BurnConfig): u8 {
    if (supply_remaining > cfg.tier_2_floor) {
        1
    } else if (supply_remaining > cfg.tier_3_floor) {
        2
    } else {
        3
    }
}
```

### Purchase Distribution

Given a purchase amount `price`, compute burn and payout:

```move
let tier = get_burn_tier(coin::total_supply(&marketplace.treasury_cap), &cfg);
let (burn_bps, contributor_bps) = match tier {
    1 => (cfg.tier_1_burn_bps, cfg.tier_1_contributor_bps),
    2 => (cfg.tier_2_burn_bps, cfg.tier_2_contributor_bps),
    _ => (cfg.tier_3_burn_bps, cfg.tier_3_contributor_bps),
};

let burn_amount = bps::apply(price, burn_bps);
let payout_amount = price - burn_amount; // avoids rounding drift
burn::destroy(burn_amount, ctx);
transfer::pay_contributor(payout_amount, uploader, ctx);
```

`bps::apply(amount, bps)` is shorthand for `(amount * bps) / 10_000`.

### Volume Required to Transition Tiers

| Transition | Tokens Burned | Burn Rate | Purchase Volume Required |
|------------|---------------|-----------|---------------------------|
| Tier 1 ➜ Tier 2 | 40M SNR | 60% | `40M / 0.60 ≈ 66.7M` SNR |
| Tier 2 ➜ Tier 3 | 20M SNR | 40% | `20M / 0.40 = 50M` SNR |
| Total to reach floor | 60M SNR | Mixed | ~116.7M SNR |

At $1/SNR, hitting the sustainability tier requires ~$116.7k in cumulative purchases; at $10/SNR it is ~$1.17M.

### Launch Edge Case

Even though only ~30M SNR will be freely circulating at launch, the tier system keys off the original minted supply. That keeps Tier 1 active until an aggregate 40M tokens have been burned, ensuring early adopters experience the intended 60% burn pressure. If we ever need to key tiers off floating supply instead, new thresholds must be derived and approved (see Open Questions).

## Marketplace Flows

We retain the existing MVP flows (submission fees, reward vesting) with updated numbers.

### Submission Burn Fee

To throttle spam uploads we continue to charge 0.001% of circulating supply (unchanged). Because total burn pressure already exists in purchases, this fee feeds the burn mechanic as well.

```move
let burn_fee = (get_circulating_supply(marketplace) * 1) / 100_000;
```

Fees are destroyed immediately, not recycled into incentives.

### Submission Rewards

Creator rewards during evaluation still vest over 90 epochs. When marketplace volume is low the contributor reserve covers payouts; once purchases ramp, payouts are funded straight from the 40%/60%/80% splits.

Vesting struct is unchanged:

```move
struct VestedBalance has store {
    total_amount: u64,
    unlock_start_epoch: u64,
    unlock_duration_epochs: u64, // 90
    claimed_amount: u64,
}
```

`calculate_unlocked_amount` helper from the previous spec still applies.

## Events

Event schemas remain the same as the prior spec with the following adjustments:

- `DatasetPurchased` emits `burn_rate_bps` and `contributor_rate_bps` (liquidity / treasury fields removed).
- `DatasetPurchased` keeps `seal_policy_id` and omits any Walrus blob identifiers.
- `SubmissionFinalized` continues to capture reward amounts and vesting schedule for auditability.

```move
struct DatasetPurchased has copy, drop {
    submission_id: ID,
    buyer: address,
    price: u64,

    burned: u64,
    burn_rate_bps: u64,
    contributor_paid: u64,
    contributor_rate_bps: u64,

    circulating_supply: u64,
    burn_tier: u8,

    seal_policy_id: String,
    purchase_timestamp: u64,
}
```

## Error Codes

```move
const E_INVALID_AMOUNT: u64 = 1001;
const E_INSUFFICIENT_BALANCE: u64 = 1002;

const E_INVALID_BURN_FEE: u64 = 2001;
const E_REWARD_POOL_DEPLETED: u64 = 2002;
const E_ALREADY_FINALIZED: u64 = 2003;
const E_INVALID_QUALITY_SCORE: u64 = 2004;

const E_NOT_LISTED: u64 = 3001;
const E_NOT_APPROVED: u64 = 3002;
const E_INVALID_PAYMENT: u64 = 3003;
const E_CONTRIBUTOR_RESERVE_EMPTY: u64 = 3004;

const E_INVALID_TIER: u64 = 4001;
const E_INVALID_BPS: u64 = 4002;

const E_UNAUTHORIZED: u64 = 5001;
const E_CIRCUIT_BREAKER_ACTIVE: u64 = 5002;
const E_COOLDOWN_NOT_ELAPSED: u64 = 5003;
```

## Testing Requirements

### Burn Tier Boundaries

```move
#[test]
fun test_tier_boundary_above_60m() {
    let supply = 60_000_000_000_000_001;
    assert!(get_burn_tier(supply, &cfg) == 1);
}

#[test]
fun test_tier_boundary_at_60m() {
    let supply = 60_000_000_000_000_000;
    assert!(get_burn_tier(supply, &cfg) == 2);
}

#[test]
fun test_tier_boundary_above_40m() {
    let supply = 40_000_000_000_000_001;
    assert!(get_burn_tier(supply, &cfg) == 2);
}

#[test]
fun test_tier_boundary_at_40m() {
    let supply = 40_000_000_000_000_000;
    assert!(get_burn_tier(supply, &cfg) == 3);
}
```

### Integration

- Simulate a sequence of purchases that drives supply from 100M ➜ 59.9M (tier change), asserting burn and payout ratios update correctly.
- Cover the path where contribution payouts come from the locked reserve until marketplace fees are sufficient.

### Negative

- Attempt a purchase when contributor payout would underflow (e.g., price smaller than burn rounding) and assert a clean abort.
- Ensure submissions cannot drain the contributor reserve below zero; payouts should abort with `E_CONTRIBUTOR_RESERVE_EMPTY`.

## Open Questions

1. **Recipient Addresses** – Need clarity on exact multisig / custody accounts for each allocation bucket.
2. **Treasury Unlock Mechanism** – Decide between on-chain time lock vs. off-chain custody for the 15M treasury tranche.
3. **Contributor Reserve Top-Up Rules** – Define if / when treasury reallocations can replenish the reserve once purchase flow is self-sustaining.
4. **Spam Fee Destination** – Confirm that submission burn fees should be destroyed rather than recycled (currently going to be burned)
5. **Launch Analytics** – Decide whether to surface both circulating and remaining supply in events / indexers for real-time tier tracking.



