import type { ReactNode } from 'react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

mock.module('@/lib/api/client', () => {
  return {
    async getKioskPrice() {
      return {
        sonar_price: '800000000',
        sui_price: '1000000000',
        reserve_balance: {
          sonar: '4200000000000000',
          sui: '3100000000000000',
        },
        current_tier: 2,
        circulating_supply: '38000000000000000',
        price_override: '750000000',
        override_active: true,
        last_synced_at: new Date().toISOString(),
      };
    },
    async getKioskStatus() {
      return {
        sonar_reserve: '4200000000000000',
        sui_reserve: '3100000000000000',
        current_tier: 2,
        circulating_supply: '38000000000000000',
        price_override: '750000000',
        override_active: true,
        last_synced_at: new Date().toISOString(),
        price_trend: [],
        last_24h_sales: {
          sonar_sold: '1000000000',
          datasets_purchased: 1,
          total_transactions: 1,
        },
      };
    },
  };
});

const { useKioskPrice } = await import('../useKioskPrice');

describe('useKioskPrice', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  test('merges override metadata from price and status responses', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useKioskPrice(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentTier).toBe(2);
    expect(result.current.circulatingSupply).toBe('38000000000000000');
    expect(result.current.overrideActive).toBe(true);
    expect(result.current.priceOverride).toBe('750000000');
    expect(result.current.sonarPriceInSui?.toFixed(3)).toBe('0.800');
  });
});
