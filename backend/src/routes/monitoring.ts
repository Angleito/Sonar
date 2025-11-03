/**
 * Kiosk Monitoring API Routes
 *
 * Endpoints:
 *   GET /api/monitoring/kiosk/metrics - Get comprehensive kiosk metrics
 *   GET /api/monitoring/kiosk/health - Run health checks and get alerts
 *   GET /api/monitoring/kiosk/alerts - Get recent alerts (last 24h)
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { kioskMonitor } from '../lib/monitoring/kiosk-monitor';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const prisma = new PrismaClient();
const adminAddresses = (process.env.MONITORING_ADMIN_ADDRESSES || '')
  .split(',')
  .map((addr) => addr.trim().toLowerCase())
  .filter(Boolean);

function authorizeMonitoring(request: FastifyRequest, reply: FastifyReply): boolean {
  if (adminAddresses.length === 0) {
    return true;
  }

  const address = request.user?.address?.toLowerCase();

  if (address && adminAddresses.includes(address)) {
    return true;
  }

  reply.status(403).send({
    success: false,
    error: 'Admin access required',
  });
  return false;
}

export async function registerMonitoringRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/monitoring/kiosk/metrics
   *
   * Returns comprehensive kiosk metrics including:
   * - Reserve levels
   * - Success rates
   * - Depletion rates
   * - Tier info
   */
  fastify.get('/api/monitoring/kiosk/metrics', { onRequest: authMiddleware }, async (request, reply) => {
    if (!authorizeMonitoring(request, reply)) {
      return;
    }

    try {
      const metrics = await kioskMonitor.getMetrics();

      return reply.status(200).send({
        success: true,
        data: {
          sonar_reserve: metrics.sonar_reserve.toString(),
          sui_reserve: metrics.sui_reserve.toString(),
          current_tier: metrics.current_tier,
          reserve_health: metrics.reserve_health,
          depletion_rate_per_hour: metrics.depletion_rate_per_hour,
          estimated_hours_until_empty: metrics.estimated_hours_until_empty,
          last_24h_purchases: metrics.last_24h_purchases,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Monitoring API] Error fetching metrics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch kiosk metrics',
      });
    }
  });

  /**
   * GET /api/monitoring/kiosk/health
   *
   * Runs all health checks and returns alerts
   */
  fastify.get('/api/monitoring/kiosk/health', { onRequest: authMiddleware }, async (request, reply) => {
    if (!authorizeMonitoring(request, reply)) {
      return;
    }

    try {
      const alerts = await kioskMonitor.runHealthChecks();

      const criticalCount = alerts.filter((a) => a.level === 'critical').length;
      const warningCount = alerts.filter((a) => a.level === 'warning').length;

      let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
      if (criticalCount > 0) {
        overallHealth = 'critical';
      } else if (warningCount > 0) {
        overallHealth = 'degraded';
      }

      return reply.status(200).send({
        success: true,
        health: overallHealth,
        alerts: alerts.map((alert) => ({
          level: alert.level,
          category: alert.category,
          message: alert.message,
          timestamp: alert.timestamp.toISOString(),
          metadata: alert.metadata,
        })),
        summary: {
          total_alerts: alerts.length,
          critical: criticalCount,
          warnings: warningCount,
        },
      });
    } catch (error) {
      console.error('[Monitoring API] Error running health checks:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to run health checks',
      });
    }
  });

  /**
   * GET /api/monitoring/kiosk/alerts
   *
   * Get recent alerts from the last 24 hours
   * (This would require persisting alerts to database in production)
   */
  fastify.get('/api/monitoring/kiosk/alerts', { onRequest: authMiddleware }, async (request, reply) => {
    if (!authorizeMonitoring(request, reply)) {
      return;
    }

    try {
      // For now, run health checks and return current alerts
      // In production, you'd query a persistent alerts table
      const alerts = await kioskMonitor.runHealthChecks();

      return reply.status(200).send({
        success: true,
        alerts: alerts.map((alert) => ({
          level: alert.level,
          category: alert.category,
          message: alert.message,
          timestamp: alert.timestamp.toISOString(),
          metadata: alert.metadata,
        })),
        note: 'Real-time alerts. For historical alerts, implement AlertLog table.',
      });
    } catch (error) {
      console.error('[Monitoring API] Error fetching alerts:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch alerts',
      });
    }
  });

  /**
   * GET /api/monitoring/kiosk/reserves
   *
   * Quick check of reserve levels only
   */
  fastify.get('/api/monitoring/kiosk/reserves', { onRequest: authMiddleware }, async (request, reply) => {
    if (!authorizeMonitoring(request, reply)) {
      return;
    }

    try {
      const { health, alerts } = await kioskMonitor.checkReserves();

      return reply.status(200).send({
        success: true,
        health,
        alerts: alerts.map((alert) => ({
          level: alert.level,
          message: alert.message,
          timestamp: alert.timestamp.toISOString(),
        })),
      });
    } catch (error) {
      console.error('[Monitoring API] Error checking reserves:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to check reserves',
      });
    }
  });

  /**
   * GET /api/monitoring/kiosk/success-rate
   *
   * Check purchase success rate only
   */
  fastify.get('/api/monitoring/kiosk/success-rate', { onRequest: authMiddleware }, async (request, reply) => {
    if (!authorizeMonitoring(request, reply)) {
      return;
    }

    try {
      const { rate, alerts } = await kioskMonitor.getPurchaseSuccessRate();

      return reply.status(200).send({
        success: true,
        success_rate: rate,
        success_rate_percent: (rate * 100).toFixed(2),
        alerts: alerts.map((alert) => ({
          level: alert.level,
          message: alert.message,
          timestamp: alert.timestamp.toISOString(),
        })),
      });
    } catch (error) {
      console.error('[Monitoring API] Error checking success rate:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to check success rate',
      });
    }
  });

  console.log('[Monitoring Routes] Registered kiosk monitoring endpoints');
}
