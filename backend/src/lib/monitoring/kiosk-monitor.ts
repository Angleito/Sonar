/**
 * Kiosk Monitoring Service
 *
 * Tracks critical kiosk metrics and sends alerts when thresholds are crossed:
 * - SONAR reserve levels (alert on low balance)
 * - Purchase success rate (alert on failures)
 * - Price tier transitions
 * - Reserve depletion rate
 *
 * Usage:
 *   import { kioskMonitor } from './lib/monitoring/kiosk-monitor';
 *   kioskMonitor.checkReserves();
 *   kioskMonitor.recordPurchaseAttempt('success');
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Monitoring configuration
const CONFIG = {
  // Alert thresholds
  SONAR_LOW_THRESHOLD: BigInt(1_000_000) * BigInt(1e9), // 1M SONAR
  SONAR_CRITICAL_THRESHOLD: BigInt(100_000) * BigInt(1e9), // 100K SONAR
  SUCCESS_RATE_WARNING: 0.85, // Alert if <85% success rate
  SUCCESS_RATE_CRITICAL: 0.70, // Critical if <70% success rate

  // Time windows
  METRICS_WINDOW_HOURS: 24,
  DEPLETION_CHECK_HOURS: 6,
};

export interface KioskMetrics {
  sonar_reserve: bigint;
  sui_reserve: bigint;
  current_tier: number;
  circulating_supply: bigint;
  price_override: bigint | null;
  last_synced_at: Date | null;
  last_24h_purchases: {
    total_attempts: number;
    successful: number;
    failed: number;
    success_rate: number;
  };
  reserve_health: 'healthy' | 'low' | 'critical';
  depletion_rate_per_hour: string; // SONAR/hour
  estimated_hours_until_empty: number | null;
}

export interface Alert {
  level: 'info' | 'warning' | 'critical';
  category: 'reserve' | 'success_rate' | 'tier_change' | 'depletion';
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

class KioskMonitor {
  private alerts: Alert[] = [];

  /**
   * Check SONAR reserve levels and return health status
   */
  async checkReserves(): Promise<{ health: string; alerts: Alert[] }> {
    const reserve = await this.getKioskReserve();
    const sonarBalance = reserve?.sonar_balance || 0n;

    this.alerts = [];

    if (sonarBalance <= CONFIG.SONAR_CRITICAL_THRESHOLD) {
      this.alerts.push({
        level: 'critical',
        category: 'reserve',
        message: `CRITICAL: SONAR reserve critically low (${this.formatSonar(sonarBalance)} SONAR)`,
        timestamp: new Date(),
        metadata: { sonar_balance: sonarBalance.toString() },
      });
      return { health: 'critical', alerts: this.alerts };
    }

    if (sonarBalance <= CONFIG.SONAR_LOW_THRESHOLD) {
      this.alerts.push({
        level: 'warning',
        category: 'reserve',
        message: `WARNING: SONAR reserve low (${this.formatSonar(sonarBalance)} SONAR). Consider refilling.`,
        timestamp: new Date(),
        metadata: { sonar_balance: sonarBalance.toString() },
      });
      return { health: 'low', alerts: this.alerts };
    }

    return { health: 'healthy', alerts: [] };
  }

  /**
   * Calculate purchase success rate in the last 24 hours
   */
  async getPurchaseSuccessRate(): Promise<{ rate: number; alerts: Alert[] }> {
    const since = new Date(Date.now() - CONFIG.METRICS_WINDOW_HOURS * 60 * 60 * 1000);

    // Get successful purchases
    const successful = await prisma.kioskPurchase.count({
      where: { created_at: { gte: since } },
    });

    // Get failed attempts (from access_log with status = 'denied' or error logs)
    const failed = await prisma.accessLog.count({
      where: {
        timestamp: { gte: since },
        status: 'denied',
      },
    });

    const total = successful + failed;
    const rate = total > 0 ? successful / total : 1.0;

    this.alerts = [];

    if (total > 10) { // Only alert if enough data
      if (rate < CONFIG.SUCCESS_RATE_CRITICAL) {
        this.alerts.push({
          level: 'critical',
          category: 'success_rate',
          message: `CRITICAL: Purchase success rate critically low (${(rate * 100).toFixed(1)}%)`,
          timestamp: new Date(),
          metadata: { success_rate: rate, successful, failed },
        });
      } else if (rate < CONFIG.SUCCESS_RATE_WARNING) {
        this.alerts.push({
          level: 'warning',
          category: 'success_rate',
          message: `WARNING: Purchase success rate below threshold (${(rate * 100).toFixed(1)}%)`,
          timestamp: new Date(),
          metadata: { success_rate: rate, successful, failed },
        });
      }
    }

    return { rate, alerts: this.alerts };
  }

  /**
   * Calculate SONAR depletion rate and estimate time until empty
   */
  async getDepletionMetrics(): Promise<{
    depletion_rate_per_hour: bigint;
    hours_until_empty: number | null;
    alerts: Alert[];
  }> {
    const hoursAgo = new Date(Date.now() - CONFIG.DEPLETION_CHECK_HOURS * 60 * 60 * 1000);

    // Get SONAR sold in last N hours
    const purchases = await prisma.kioskPurchase.aggregate({
      where: { created_at: { gte: hoursAgo } },
      _sum: { sonar_amount: true },
    });

    const sonarSold = purchases._sum.sonar_amount || 0n;
    const depletionRate = sonarSold / BigInt(CONFIG.DEPLETION_CHECK_HOURS);

    const reserve = await this.getKioskReserve();
    const currentBalance = reserve?.sonar_balance || 0n;

    let hoursUntilEmpty: number | null = null;
    if (depletionRate > 0n) {
      hoursUntilEmpty = Number(currentBalance / depletionRate);
    }

    this.alerts = [];

    // Alert if kiosk will be empty within 48 hours at current rate
    if (hoursUntilEmpty !== null && hoursUntilEmpty < 48) {
      this.alerts.push({
        level: 'warning',
        category: 'depletion',
        message: `WARNING: At current rate, kiosk will be empty in ${hoursUntilEmpty.toFixed(1)} hours`,
        timestamp: new Date(),
        metadata: {
          depletion_rate_per_hour: depletionRate.toString(),
          hours_until_empty: hoursUntilEmpty,
        },
      });
    }

    return {
      depletion_rate_per_hour: depletionRate,
      hours_until_empty: hoursUntilEmpty,
      alerts: this.alerts,
    };
  }

  /**
   * Get comprehensive kiosk metrics
   */
  async getMetrics(): Promise<KioskMetrics> {
    const reserve = await this.getKioskReserve();
    const sonarBalance = reserve?.sonar_balance || 0n;
    const suiBalance = reserve?.sui_balance || 0n;

    // Calculate tier from reserve
    const tier = reserve?.current_tier ?? this.calculateTier(sonarBalance);

    // Get purchase metrics
    const since = new Date(Date.now() - CONFIG.METRICS_WINDOW_HOURS * 60 * 60 * 1000);
    const successful = await prisma.kioskPurchase.count({
      where: { created_at: { gte: since } },
    });
    const failed = await prisma.accessLog.count({
      where: {
        timestamp: { gte: since },
        status: 'denied',
      },
    });

    const total = successful + failed;
    const successRate = total > 0 ? successful / total : 1.0;

    // Get depletion metrics
    const depletion = await this.getDepletionMetrics();

    // Determine health
    let health: 'healthy' | 'low' | 'critical' = 'healthy';
    if (sonarBalance <= CONFIG.SONAR_CRITICAL_THRESHOLD) {
      health = 'critical';
    } else if (sonarBalance <= CONFIG.SONAR_LOW_THRESHOLD) {
      health = 'low';
    }

    return {
      sonar_reserve: sonarBalance,
      sui_reserve: suiBalance,
      current_tier: tier,
      circulating_supply: reserve?.circulating_supply || 0n,
      price_override: reserve?.price_override ?? null,
      last_synced_at: reserve?.last_synced_at ?? null,
      last_24h_purchases: {
        total_attempts: total,
        successful,
        failed,
        success_rate: successRate,
      },
      reserve_health: health,
      depletion_rate_per_hour: depletion.depletion_rate_per_hour.toString(),
      estimated_hours_until_empty: depletion.hours_until_empty,
    };
  }

  /**
   * Run all health checks and collect alerts
   */
  async runHealthChecks(): Promise<Alert[]> {
    const allAlerts: Alert[] = [];

    // Check reserves
    const reserveCheck = await this.checkReserves();
    allAlerts.push(...reserveCheck.alerts);

    // Check success rate
    const successCheck = await this.getPurchaseSuccessRate();
    allAlerts.push(...successCheck.alerts);

    // Check depletion
    const depletionCheck = await this.getDepletionMetrics();
    allAlerts.push(...depletionCheck.alerts);

    // Log all alerts
    for (const alert of allAlerts) {
      if (alert.level === 'critical') {
        console.error(`[KIOSK MONITOR] ${alert.message}`, alert.metadata);
      } else if (alert.level === 'warning') {
        console.warn(`[KIOSK MONITOR] ${alert.message}`, alert.metadata);
      } else {
        console.info(`[KIOSK MONITOR] ${alert.message}`, alert.metadata);
      }
    }

    return allAlerts;
  }

  /**
   * Record tier transition for monitoring
   */
  async recordTierTransition(oldTier: number, newTier: number, reserve: bigint): Promise<void> {
    console.info(
      `[KIOSK MONITOR] Tier transition: ${oldTier} → ${newTier} (reserve: ${this.formatSonar(reserve)} SONAR)`
    );

    // Record in price history with tier info
    await prisma.priceHistory.create({
      data: {
        recorded_price: this.getTierPrice(newTier),
        tier_at_time: newTier,
        admin_override: false,
      },
    });
  }

  // ==================== Private Helpers ====================

  private async getKioskReserve() {
    return await prisma.kioskReserve.findFirst({
      orderBy: { updated_at: 'desc' },
    });
  }

  private calculateTier(sonarReserve: bigint): number {
    const TIER_1 = 50_000_000n * BigInt(1e9);
    const TIER_2 = 35_000_000n * BigInt(1e9);
    const TIER_3 = 20_000_000n * BigInt(1e9);

    if (sonarReserve >= TIER_1) return 1;
    if (sonarReserve >= TIER_2) return 2;
    if (sonarReserve >= TIER_3) return 3;
    return 4;
  }

  private getTierPrice(tier: number): bigint {
    const TIER_PRICES = {
      1: BigInt(1e9),   // 1.0 SUI
      2: BigInt(8e8),   // 0.8 SUI
      3: BigInt(6e8),   // 0.6 SUI
      4: BigInt(4e8),   // 0.4 SUI
    };
    return TIER_PRICES[tier as keyof typeof TIER_PRICES] || BigInt(1e9);
  }

  private formatSonar(baseUnits: bigint): string {
    const sonar = Number(baseUnits) / 1e9;
    if (sonar >= 1_000_000) {
      return `${(sonar / 1_000_000).toFixed(2)}M`;
    }
    if (sonar >= 1_000) {
      return `${(sonar / 1_000).toFixed(2)}K`;
    }
    return sonar.toFixed(2);
  }
}

// Singleton instance
export const kioskMonitor = new KioskMonitor();

// Export types
export type { KioskMetrics, Alert };
