'use client';

/**
 * Kiosk Monitoring Dashboard
 *
 * Admin component for monitoring kiosk health metrics:
 * - Reserve levels (SONAR/SUI)
 * - Success rate
 * - Active alerts
 * - Depletion rate
 *
 * Usage:
 *   <KioskMonitoringDashboard />
 */

import { useCallback, useEffect, useState } from 'react';
import { formatBigIntAmount, formatBigIntToMillions } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface KioskMetrics {
  sonar_reserve: string;
  sui_reserve: string;
  current_tier: number;
  circulating_supply: string;
  price_override: string | null;
  override_active: boolean;
  last_synced_at: string | null;
  reserve_health: 'healthy' | 'low' | 'critical';
  depletion_rate_per_hour: string;
  estimated_hours_until_empty: number | null;
  last_24h_purchases: {
    total_attempts: number;
    successful: number;
    failed: number;
    success_rate: number;
  };
}

interface Alert {
  level: 'info' | 'warning' | 'critical';
  category: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface HealthResponse {
  health: 'healthy' | 'degraded' | 'critical';
  alerts: Alert[];
  summary: {
    total_alerts: number;
    critical: number;
    warnings: number;
  };
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export function KioskMonitoringDashboard() {
  const [metrics, setMetrics] = useState<KioskMetrics | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, token, isLoading: authLoading } = useAuth();

  const fetchMetrics = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const headers: Record<string, string> = {
        authorization: `Bearer ${token}`,
      };

      const [metricsRes, healthRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/monitoring/kiosk/metrics`, { headers }),
        fetch(`${BACKEND_URL}/api/monitoring/kiosk/health`, { headers }),
      ]);

      if (!metricsRes.ok || !healthRes.ok) {
        throw new Error('Failed to fetch monitoring data');
      }

      const metricsData = await metricsRes.json();
      const healthData = await healthRes.json();

      setMetrics(metricsData.data);
      setHealth(healthData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchMetrics, isAuthenticated, token]);

  if (authLoading) {
    return (
      <div className="p-6 bg-gray-100 rounded-lg">
        <p className="text-gray-600">Loading authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200">
        <p className="text-yellow-700 font-medium">Admin authentication required</p>
        <p className="text-sm text-yellow-700 mt-2">
          Please sign in with an authorized wallet to view kiosk monitoring data.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 bg-gray-100 rounded-lg">
        <p className="text-gray-600">Loading monitoring data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={fetchMetrics}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metrics || !health) {
    return null;
  }

  const healthColor = {
    healthy: 'bg-green-100 text-green-800 border-green-300',
    degraded: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    critical: 'bg-red-100 text-red-800 border-red-300',
  }[health.health];

  const reserveHealthColor = {
    healthy: 'text-green-600',
    low: 'text-yellow-600',
    critical: 'text-red-600',
  }[metrics.reserve_health];

  return (
    <div className="space-y-6">
      {/* Overall Health Status */}
      <div className={`p-6 rounded-lg border ${healthColor}`}>
        <h2 className="text-xl font-bold mb-2">Overall Health</h2>
        <p className="text-2xl font-bold uppercase">{health.health}</p>
        <div className="mt-2 text-sm">
          <span className="font-medium">{health.summary.critical}</span> critical alerts,{' '}
          <span className="font-medium">{health.summary.warnings}</span> warnings
        </div>
      </div>

      {/* Reserve Levels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-2">SONAR Reserve</h3>
          <p className="text-3xl font-bold">
            {formatBigIntToMillions(metrics.sonar_reserve, 9)}
          </p>
          <p className={`text-sm font-medium mt-1 ${reserveHealthColor}`}>
            {metrics.reserve_health.toUpperCase()}
          </p>
          <div className="mt-3 text-sm text-gray-600">
            <p>Tier: {metrics.current_tier}</p>
          <p>
            Circulating: {formatBigIntAmount(BigInt(metrics.circulating_supply), 9, 2)} SONAR
          </p>
          {metrics.override_active && metrics.price_override && (
            <p className="text-yellow-600">
              Override: {formatBigIntAmount(BigInt(metrics.price_override), 9, 3)} SUI
            </p>
          )}
          {metrics.last_synced_at && (
            <p className="text-xs text-gray-500 mt-1">
              Synced {new Date(metrics.last_synced_at).toLocaleTimeString()}
            </p>
          )}
            <p>
              Depletion:{' '}
            {formatBigIntAmount(BigInt(metrics.depletion_rate_per_hour), 9, 2)} SONAR/hour
            </p>
            {metrics.estimated_hours_until_empty && (
              <p className="text-yellow-600 font-medium mt-1">
                Empty in ~{metrics.estimated_hours_until_empty.toFixed(0)} hours
              </p>
            )}
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-2">SUI Reserve</h3>
          <p className="text-3xl font-bold">
            {formatBigIntAmount(metrics.sui_reserve, 9, 3)} SUI
          </p>
          <p className="text-sm text-gray-600 mt-1">Accumulated from sales</p>
        </div>
      </div>

      {/* Purchase Success Rate */}
      <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-2">Purchase Success Rate (24h)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Success Rate</p>
            <p className="text-2xl font-bold text-green-600">
              {(metrics.last_24h_purchases.success_rate * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Attempts</p>
            <p className="text-2xl font-bold">{metrics.last_24h_purchases.total_attempts}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Successful</p>
            <p className="text-2xl font-bold text-green-600">
              {metrics.last_24h_purchases.successful}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Failed</p>
            <p className="text-2xl font-bold text-red-600">
              {metrics.last_24h_purchases.failed}
            </p>
          </div>
        </div>
      </div>

      {/* Active Alerts */}
      {health.alerts.length > 0 && (
        <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Active Alerts</h3>
          <div className="space-y-3">
            {health.alerts.map((alert, idx) => {
              const alertColor = {
                critical: 'bg-red-50 border-red-300 text-red-800',
                warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
                info: 'bg-blue-50 border-blue-300 text-blue-800',
              }[alert.level];

              return (
                <div key={idx} className={`p-4 rounded border ${alertColor}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium uppercase text-xs mb-1">
                        {alert.level} - {alert.category}
                      </p>
                      <p className="text-sm">{alert.message}</p>
                      {alert.metadata && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer">Details</summary>
                          <pre className="text-xs mt-1 overflow-x-auto">
                            {JSON.stringify(alert.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <span className="text-xs opacity-70 ml-2">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Alerts */}
      {health.alerts.length === 0 && (
        <div className="p-6 bg-green-50 rounded-lg border border-green-200">
          <p className="text-green-700 font-medium">✓ No active alerts. System healthy.</p>
        </div>
      )}

      {/* Refresh Info */}
      <div className="text-center text-sm text-gray-500">
        <p>Auto-refreshes every 30 seconds</p>
        <button
          onClick={fetchMetrics}
          className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
        >
          Refresh Now
        </button>
      </div>
    </div>
  );
}
