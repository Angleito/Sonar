import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';

const originalFetch = global.fetch;
const authState = {
  isAuthenticated: false,
  token: null as string | null,
  isLoading: false,
  error: null as Error | null,
  authenticate: () => Promise.resolve(''),
  logout: () => undefined,
  getAuthHeader: () => null as string | null,
  isTokenValid: () => false,
};

mock.module('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}));

const { KioskMonitoringDashboard } = await import('../KioskMonitoringDashboard');

describe('KioskMonitoringDashboard auth gating', () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.token = null;
    authState.getAuthHeader = () => null;
    authState.isTokenValid = () => false;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('prompts for authentication when user not signed in', () => {
    render(<KioskMonitoringDashboard />);
    expect(screen.getByText(/Admin authentication required/)).toBeInTheDocument();
  });
});
describe('KioskMonitoringDashboard authorized flow', () => {
  beforeEach(() => {
    authState.isAuthenticated = true;
    authState.token = 'test-jwt';
    authState.getAuthHeader = () => 'Bearer test-jwt';
    authState.isTokenValid = () => true;
  });

  test('sends authorization header when fetching metrics', async () => {
    const metricsResponse = {
      success: true,
      data: {
        sonar_reserve: '4200000000000000',
        sui_reserve: '3100000000000000',
        current_tier: 2,
        circulating_supply: '38000000000000000',
        price_override: null,
        override_active: false,
        last_synced_at: new Date().toISOString(),
        reserve_health: 'healthy',
        depletion_rate_per_hour: '0',
        estimated_hours_until_empty: null,
        last_24h_purchases: {
          total_attempts: 1,
          successful: 1,
          failed: 0,
          success_rate: 1,
        },
      },
    };

    const healthResponse = {
      success: true,
      health: 'healthy',
      alerts: [],
      summary: {
        total_alerts: 0,
        critical: 0,
        warnings: 0,
      },
    };

    let callCount = 0;
    const fetchMock: typeof fetch = async (input: RequestInfo, init?: RequestInit) => {
      callCount += 1;
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/metrics')) {
        expect(init?.headers).toMatchObject({ authorization: 'Bearer test-jwt' });
        return new Response(JSON.stringify(metricsResponse), { status: 200 });
      }

      return new Response(JSON.stringify(healthResponse), { status: 200 });
    };

    global.fetch = fetchMock;

    render(<KioskMonitoringDashboard />);

    await waitFor(() => {
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    expect(screen.getByText(/Overall Health/)).toBeInTheDocument();
  });
});
