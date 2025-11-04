# Kiosk Sync Architecture

## Overview

The SONAR kiosk state synchronization system uses a **3-tier strategy** to keep the backend database in sync with on-chain kiosk data from the Sui blockchain. This document explains how each tier works, why they're needed, and how they interact.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Sui Blockchain (Source of Truth)              │
│                   Marketplace Smart Contract                     │
│                        KioskDesk State                           │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ├──────────────┬──────────────┬─────────────────
                   │              │              │
        ┌──────────▼────┐  ┌─────▼─────┐  ┌────▼──────┐
        │  Periodic      │  │  Event-   │  │ On-Demand │
        │  Sync          │  │  Driven   │  │   Sync    │
        │  (5 minutes)   │  │  Sync     │  │  (60s TTL)│
        └──────┬─────────┘  └─────┬─────┘  └────┬──────┘
               │                  │              │
               └──────────────────┼──────────────┘
                                  │
                   ┌──────────────▼──────────────┐
                   │ syncKioskSnapshotToDatabase │
                   │  (Core Sync Function)       │
                   └──────────────┬──────────────┘
                                  │
                   ┌──────────────▼──────────────┐
                   │    PostgreSQL Database       │
                   │    kioskReserve table        │
                   └─────────────────────────────┘
```

---

## Sync Tiers

### 1. Periodic Sync (Background Scheduler)

**File:** `backend/src/index.ts` (lines 146-153)

**Frequency:** Every 5 minutes

**Purpose:**
- Ensure data freshness even during low activity
- Catch any missed events
- Provide baseline sync cadence

**Implementation:**
```typescript
setInterval(async () => {
  try {
    await syncKioskSnapshotToDatabase(prisma);
    await kioskMonitor.runHealthChecks(prisma);
  } catch (error) {
    logger.error({ error }, 'Periodic kiosk sync failed');
  }
}, 5 * 60 * 1000); // 5 minutes
```

**Triggers:**
- Time-based: Every 5 minutes after server startup
- Runs continuously in background
- Independent of user activity

---

### 2. Event-Driven Sync (Real-Time Updates)

**File:** `backend/src/lib/kiosk-listener.ts`

**Latency:** Near real-time (blockchain finality + event processing)

**Purpose:**
- Immediate sync when kiosk state changes on-chain
- Capture all blockchain events affecting kiosk
- Minimize lag between on-chain and database state

**Monitored Events:**
1. **SonarSold** (line 78)
   - Triggered when: User buys SONAR from kiosk with SUI
   - Updates: sonar_reserve, sui_reserve, total_sonar_sold

2. **DatasetPurchasedViaKiosk** (line 115)
   - Triggered when: User buys dataset using SONAR from kiosk
   - Updates: total_datasets_purchased

3. **KioskPriceUpdated** (line 145)
   - Triggered when: Admin updates kiosk pricing
   - Updates: base_sonar_price, current_tier

**Implementation:**
```typescript
eventSubscription.on('SonarSold', async (event) => {
  logger.info({ event }, 'Kiosk SONAR sale detected');
  await syncKioskSnapshotToDatabase(prisma);
});
```

**Event Flow:**
```
Blockchain TX → Event Emitted → Listener Catches → syncKioskSnapshotToDatabase() → Database Updated
```

---

### 3. On-Demand Sync (TTL-Based Cache)

**File:** `backend/src/services/kiosk-service.ts` (lines 34-45)

**TTL:** 60 seconds

**Purpose:**
- Lazy sync on API reads
- Avoid unnecessary syncs when data is fresh
- Balance between freshness and performance

**Implementation:**
```typescript
const requiresSync =
  SONAR_MARKETPLACE_ID &&
  SONAR_MARKETPLACE_ID !== '0x0' &&
  (!kiosk || Date.now() - kiosk.last_synced_at.getTime() > KIOSK_SYNC_TTL_MS);

if (requiresSync) {
  logger.debug({ kioskId: kiosk?.id }, 'Refreshing kiosk snapshot from blockchain');
  await syncKioskSnapshotToDatabase(prisma);
  kiosk = await prisma.kioskReserve.findFirst({
    orderBy: { updated_at: 'desc' },
  });
}
```

**Triggers:**
- API endpoint reads (e.g., `/api/kiosk/status`)
- Data older than 60 seconds
- First read after server restart

---

## Core Sync Function

**File:** `backend/src/lib/kiosk/state.ts`

**Function:** `syncKioskSnapshotToDatabase(prisma: PrismaClient)`

**What it does:**
1. Queries marketplace object from Sui blockchain via RPC
2. Extracts kiosk state from `marketplace.kiosk` field
3. Upserts data into `kioskReserve` table in PostgreSQL
4. Records `last_synced_at` timestamp

**Data Synced:**
- `sonar_reserve` - SONAR tokens available for sale
- `sui_reserve` - SUI collected from sales
- `base_sonar_price` - Current price per SONAR in SUI
- `current_tier` - Economic tier (1-4)
- `total_sonar_sold` - Cumulative SONAR sold
- `total_datasets_purchased` - Cumulative dataset purchases via kiosk

**Reliability:**
- Uses Dreamlit's `suiQueryExecutor` with built-in retry logic
- Rate-limited to protect RPC endpoint
- Graceful error handling with logging

---

## Why 3 Tiers?

### Problem: Blockchain ↔ Database Sync is Hard

**Challenge 1: Event Loss**
- Blockchain events can be missed (network issues, restarts)
- **Solution:** Periodic sync catches missed events

**Challenge 2: Latency**
- Periodic sync has 0-5 minute lag
- **Solution:** Event-driven sync provides near real-time updates

**Challenge 3: Performance**
- Syncing on every read is expensive
- **Solution:** TTL-based cache reduces unnecessary syncs

### The 3-Tier Strategy Solves All Three:

| Tier | Latency | Reliability | Performance |
|------|---------|-------------|-------------|
| **Periodic** | 0-5 min | ⭐⭐⭐ High (catches all) | ⚠️ Moderate (scheduled) |
| **Event-Driven** | <30 sec | ⭐⭐ Medium (depends on events) | ✅ Good (only on change) |
| **On-Demand** | ~1 sec | ⭐ Low (reactive only) | ⭐⭐⭐ Excellent (cached) |

**Combined:** ⚡ Fast + 🛡️ Reliable + 🚀 Performant

---

## Monitoring & Observability

### Health Checks

**File:** `backend/src/lib/monitoring/kiosk-monitor.ts`

**Endpoint:** `/api/monitoring/kiosk/health`

**Checks:**
1. Database connectivity (`kioskReserve` table accessible)
2. Data freshness (last sync < 10 minutes)
3. Sui RPC connectivity (can query marketplace object)

### Metrics Tracked

**Database Metrics:**
- Last sync timestamp
- Sync success/failure count
- Average sync duration

**Blockchain Metrics:**
- Event processing lag
- RPC query success rate
- Rate limit usage

---

## Configuration

### Environment Variables

```bash
# Required
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SONAR_MARKETPLACE_ID=0xaa422269e77e2197188f9c8e47ffb3faf21c0bafff1d5d04ea9613acc4994bb4

# Optional (defaults shown)
KIOSK_SYNC_TTL_MS=60000  # 60 seconds
```

### Tuning Recommendations

**High-Traffic Scenarios:**
- Reduce periodic sync interval: 3 minutes
- Reduce TTL: 30 seconds
- Increase RPC rate limits

**Low-Traffic Scenarios:**
- Increase periodic sync interval: 10 minutes
- Increase TTL: 120 seconds
- Use default rate limits

---

## Troubleshooting

### Issue: "Kiosk data is stale"

**Symptoms:**
- API returns old prices
- Database timestamp > 5 minutes old

**Debug Steps:**
1. Check periodic sync logs: Search for "Periodic kiosk sync" in logs
2. Check event listener: Verify `kiosk-listener.ts` is active
3. Check RPC connectivity: `curl -X POST $SUI_RPC_URL`
4. Check database: `SELECT last_synced_at FROM kioskReserve ORDER BY updated_at DESC LIMIT 1;`

**Common Causes:**
- RPC endpoint down
- Event subscription disconnected
- Database write permissions
- SONAR_MARKETPLACE_ID misconfigured

---

### Issue: "Sync too frequent (performance)"

**Symptoms:**
- High RPC usage
- Slow API responses
- Rate limit errors

**Debug Steps:**
1. Check sync logs: Count syncs per minute
2. Check TTL: Verify `KIOSK_SYNC_TTL_MS` is set
3. Check event listener: Ensure not triggering duplicate syncs

**Solutions:**
- Increase TTL to 120-180 seconds
- Add sync debouncing (prevent multiple syncs within 10s)
- Increase periodic sync interval

---

## Future Improvements

### Planned Enhancements

1. **WebSocket Event Streaming**
   - Replace polling with WebSocket subscriptions
   - Reduce latency to <5 seconds

2. **Differential Sync**
   - Only update changed fields
   - Reduce database write load

3. **Sync Metrics Dashboard**
   - Grafana dashboard for sync health
   - Alert on sync failures

4. **Multi-Region Caching**
   - Distributed cache with Redis
   - Reduce database load

---

## Related Files

| File | Purpose |
|------|---------|
| `backend/src/lib/kiosk/state.ts` | Core sync logic |
| `backend/src/lib/kiosk-listener.ts` | Event-driven sync |
| `backend/src/services/kiosk-service.ts` | On-demand sync + API |
| `backend/src/lib/monitoring/kiosk-monitor.ts` | Health checks |
| `backend/src/index.ts` | Periodic sync setup |
| `contracts/sources/marketplace.move` | Kiosk smart contract |

---

## Summary

The SONAR kiosk sync architecture uses three complementary strategies:

1. **Periodic Sync** - Reliable baseline (5-minute cadence)
2. **Event-Driven Sync** - Real-time updates (blockchain events)
3. **On-Demand Sync** - Performance optimization (60-second TTL)

This multi-tier approach ensures:
- ✅ Data is never more than 60 seconds stale (TTL)
- ✅ Critical changes sync in <30 seconds (events)
- ✅ Missed events caught within 5 minutes (periodic)
- ✅ Minimal database/RPC load (caching + rate limiting)

**For most use cases, this architecture provides the right balance of freshness, reliability, and performance.**
