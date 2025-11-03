# Kiosk Monitoring System

Comprehensive monitoring for the SONAR Kiosk Liquidity Pool, tracking reserve levels, transaction health, and alerting on critical thresholds.

## Overview

The kiosk monitoring system provides:
- **Reserve Level Tracking**: SONAR and SUI reserve balances with low/critical alerts
- **Success Rate Monitoring**: 24-hour purchase success rate with degradation alerts
- **Depletion Tracking**: Calculates depletion rate and estimates time until reserve empty
- **Tier Transition Logging**: Records when pricing tiers change
- **Real-time Alerts**: Automated warnings and critical alerts

## Architecture

### Backend Components

#### 1. Kiosk Monitor Service (`backend/src/lib/monitoring/kiosk-monitor.ts`)

Core monitoring service that performs health checks:

```typescript
import { kioskMonitor } from './lib/monitoring/kiosk-monitor';

// Check reserve levels
const { health, alerts } = await kioskMonitor.checkReserves();

// Get purchase success rate
const { rate, alerts } = await kioskMonitor.getPurchaseSuccessRate();

// Calculate depletion metrics
const { depletion_rate_per_hour, hours_until_empty } = await kioskMonitor.getDepletionMetrics();

// Get comprehensive metrics
const metrics = await kioskMonitor.getMetrics();

// Run all health checks
const alerts = await kioskMonitor.runHealthChecks();
```

**Key Features:**
- BigInt-safe calculations for all token amounts
- Configurable alert thresholds
- Automatic logging of all alerts
- Idempotent tier transition tracking

#### 2. Monitoring API Routes (`backend/src/routes/monitoring.ts`)

RESTful endpoints for accessing monitoring data:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/monitoring/kiosk/metrics` | GET | Comprehensive kiosk metrics |
| `/api/monitoring/kiosk/health` | GET | Health checks with alerts |
| `/api/monitoring/kiosk/reserves` | GET | Reserve levels only |
| `/api/monitoring/kiosk/success-rate` | GET | Purchase success rate only |
| `/api/monitoring/kiosk/alerts` | GET | Recent alerts (24h) |

**Example Response** (`/api/monitoring/kiosk/health`):
```json
{
  "success": true,
  "health": "degraded",
  "alerts": [
    {
      "level": "warning",
      "category": "reserve",
      "message": "WARNING: SONAR reserve low (850.5K SONAR). Consider refilling.",
      "timestamp": "2025-01-15T10:30:00Z",
      "metadata": {
        "sonar_balance": "850500000000000"
      }
    }
  ],
  "summary": {
    "total_alerts": 1,
    "critical": 0,
    "warnings": 1
  }
}
```

#### 3. Background Health Checks

Automated periodic health checks run every 5 minutes:

```typescript
// In backend/src/index.ts
setInterval(async () => {
  await kioskMonitor.runHealthChecks();
}, 5 * 60 * 1000); // 5 minutes
```

All alerts are automatically logged to console with appropriate severity:
- `console.error()` for critical alerts
- `console.warn()` for warnings
- `console.info()` for informational alerts

### Frontend Components

#### 1. Kiosk Monitoring Dashboard (`frontend/components/admin/KioskMonitoringDashboard.tsx`)

React component displaying real-time metrics:

```tsx
import { KioskMonitoringDashboard } from '@/components/admin/KioskMonitoringDashboard';

<KioskMonitoringDashboard />
```

**Features:**
- Auto-refresh every 30 seconds
- Color-coded health status (green/yellow/red)
- Detailed alert cards with expandable metadata
- Reserve depletion estimates
- 24-hour purchase success metrics

#### 2. Admin Monitoring Page (`frontend/app/admin/monitoring/page.tsx`)

Full admin page at `/admin/monitoring`:

```
Route: http://localhost:3000/admin/monitoring
```

**Note:** In production, protect this route with authentication middleware.

## Alert Thresholds

### Reserve Levels

| Level | SONAR Balance | Action |
|-------|--------------|--------|
| **Healthy** | > 1M SONAR | No action needed |
| **Low** | 100K - 1M SONAR | **WARNING**: Consider refilling kiosk |
| **Critical** | < 100K SONAR | **CRITICAL**: Refill immediately |

### Purchase Success Rate

| Level | Success Rate | Action |
|-------|-------------|--------|
| **Healthy** | ≥ 85% | No action needed |
| **Degraded** | 70% - 85% | **WARNING**: Investigate failures |
| **Critical** | < 70% | **CRITICAL**: System health issue |

### Depletion Rate

- **Warning**: If kiosk will be empty within 48 hours at current depletion rate
- Calculated over 6-hour rolling window

## Monitoring Configuration

### Environment Variables

No additional environment variables required. Thresholds are configured in `backend/src/lib/monitoring/kiosk-monitor.ts`:

```typescript
const CONFIG = {
  SONAR_LOW_THRESHOLD: 1_000_000 * 1e9,      // 1M SONAR
  SONAR_CRITICAL_THRESHOLD: 100_000 * 1e9,   // 100K SONAR
  SUCCESS_RATE_WARNING: 0.85,                // 85%
  SUCCESS_RATE_CRITICAL: 0.70,               // 70%
  METRICS_WINDOW_HOURS: 24,
  DEPLETION_CHECK_HOURS: 6,
};
```

To adjust thresholds, edit these values and restart the backend.

### Database Tables Used

The monitoring system queries these Prisma tables:

- `KioskReserve`: Current SONAR/SUI reserve balances
- `KioskPurchase`: Successful purchase records
- `AccessLog`: Failed access attempts (denied purchases)
- `PriceHistory`: Tier transitions and price changes

## Usage Examples

### 1. Check Current Health Status

```bash
curl http://localhost:3001/api/monitoring/kiosk/health | jq
```

### 2. Get Comprehensive Metrics

```bash
curl http://localhost:3001/api/monitoring/kiosk/metrics | jq
```

### 3. Monitor Reserve Levels Only

```bash
curl http://localhost:3001/api/monitoring/kiosk/reserves | jq
```

### 4. Programmatic Integration

```typescript
import { kioskMonitor } from './lib/monitoring/kiosk-monitor';

async function checkKioskHealth() {
  const metrics = await kioskMonitor.getMetrics();

  if (metrics.reserve_health === 'critical') {
    // Send alert to admin (email, Slack, PagerDuty, etc.)
    await sendCriticalAlert(metrics);
  }

  if (metrics.estimated_hours_until_empty && metrics.estimated_hours_until_empty < 24) {
    // Auto-refill from treasury
    await autoRefillKiosk();
  }
}
```

## Alert Integration

### Production Recommendations

For production deployments, integrate alerts with:

**1. Logging Services**
```typescript
// Example: Send to Sentry
import * as Sentry from '@sentry/node';

if (alert.level === 'critical') {
  Sentry.captureMessage(alert.message, {
    level: 'error',
    extra: alert.metadata,
  });
}
```

**2. Communication Channels**
- **Slack**: Post critical alerts to admin channel
- **PagerDuty**: Create incidents for critical thresholds
- **Email**: Send daily health summaries

**3. Persistent Alert Storage**

Create an `AlertLog` table to persist alerts:

```prisma
model AlertLog {
  id        String   @id @default(uuid())
  level     String   // 'info' | 'warning' | 'critical'
  category  String
  message   String
  metadata  Json?
  timestamp DateTime @default(now())

  @@index([level, timestamp])
}
```

Then update `kiosk-monitor.ts` to persist alerts:

```typescript
async runHealthChecks(): Promise<Alert[]> {
  const allAlerts = [...]; // collect alerts

  // Persist to database
  await prisma.alertLog.createMany({
    data: allAlerts.map(alert => ({
      level: alert.level,
      category: alert.category,
      message: alert.message,
      metadata: alert.metadata || {},
      timestamp: alert.timestamp,
    })),
  });

  return allAlerts;
}
```

## Metrics Dashboard

The frontend monitoring dashboard displays:

### Overall Health Card
- System status: Healthy / Degraded / Critical
- Alert summary counts

### Reserve Metrics
- **SONAR Reserve**: Current balance with health indicator
- **Current Tier**: Pricing tier (1-4)
- **Depletion Rate**: SONAR spent per hour
- **Time Until Empty**: Estimated hours remaining

### SUI Reserve
- **SUI Balance**: Accumulated from sales
- **Growth Rate**: Not yet implemented (future feature)

### Purchase Metrics (24h)
- **Success Rate**: Percentage of successful purchases
- **Total Attempts**: All purchase attempts
- **Successful**: Completed purchases
- **Failed**: Denied or errored purchases

### Active Alerts
- Color-coded alert cards (red/yellow/blue)
- Expandable metadata for debugging
- Timestamp for each alert

## Troubleshooting

### High Depletion Rate

**Symptom**: "At current rate, kiosk will be empty in X hours"

**Solutions**:
1. Fund kiosk with more SONAR:
   ```bash
   ./scripts/kiosk-admin.sh fund 10000000  # 10M SONAR
   ```
2. Increase SUI cut to auto-refill faster:
   ```bash
   ./scripts/kiosk-admin.sh sui-cut 50  # Route 50% of fees to kiosk
   ```
3. Adjust pricing to slow demand:
   ```bash
   ./scripts/kiosk-admin.sh price 1.5  # Increase price to 1.5 SUI
   ```

### Low Success Rate

**Symptom**: Success rate < 85%

**Investigation Steps**:
1. Check backend logs for errors:
   ```bash
   tail -f backend.log | grep ERROR
   ```
2. Query access logs for denied purchases:
   ```sql
   SELECT * FROM access_log WHERE status = 'denied' ORDER BY timestamp DESC LIMIT 10;
   ```
3. Common causes:
   - Insufficient SONAR in kiosk
   - Network issues (RPC timeout)
   - Gas price spikes
   - Smart contract errors

### Critical Reserve Level

**Symptom**: SONAR reserve < 100K

**Immediate Actions**:
1. **Stop kiosk purchases** temporarily (disable frontend)
2. **Fund immediately** from treasury wallet
3. **Verify auto-refill** is working:
   ```bash
   ./scripts/kiosk-admin.sh status
   ```

## Performance Considerations

### Database Queries

All monitoring queries use indexed columns:
- `KioskPurchase.created_at` (indexed)
- `AccessLog.timestamp` (indexed)
- `PriceHistory.timestamp` (indexed)

No full table scans occur during health checks.

### API Response Times

Typical response times:
- `/api/monitoring/kiosk/metrics`: ~50-100ms
- `/api/monitoring/kiosk/health`: ~80-150ms (runs 3 checks)
- `/api/monitoring/kiosk/reserves`: ~30-50ms (single query)

### Background Job Impact

The 5-minute health check job runs asynchronously and does not block request handling. Estimated resource usage:
- CPU: <1% during check
- Memory: ~5MB for query results
- Duration: ~200ms total

## Future Enhancements

Planned monitoring improvements:

1. **Historical Metrics Dashboard**
   - Reserve level trends (7-day chart)
   - Success rate trends
   - Tier transition history

2. **Predictive Alerts**
   - Machine learning for demand forecasting
   - Proactive refill recommendations
   - Anomaly detection

3. **Custom Alert Rules**
   - User-defined thresholds
   - Webhook integrations
   - Alert suppression during maintenance

4. **Mobile Dashboard**
   - React Native admin app
   - Push notifications for critical alerts
   - Quick admin actions (fund/withdraw)

## References

- **Backend Monitor**: `backend/src/lib/monitoring/kiosk-monitor.ts`
- **API Routes**: `backend/src/routes/monitoring.ts`
- **Frontend Dashboard**: `frontend/components/admin/KioskMonitoringDashboard.tsx`
- **Admin Page**: `frontend/app/admin/monitoring/page.tsx`
- **Kiosk Admin CLI**: `scripts/kiosk-admin.sh`
