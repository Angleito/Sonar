import { describe, expect, mock, test } from 'bun:test';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

mock.module('@/hooks/useKioskPrice', () => {
  return {
    useKioskPrice: () => ({
      price: {
        sonar_price: '800000000',
        sui_price: '1000000000',
        reserve_balance: { sonar: '4200000000000000', sui: '3100000000000000' },
        current_tier: 2,
        circulating_supply: '38000000000000000',
        price_override: '750000000',
        override_active: true,
        last_synced_at: new Date('2025-01-01T00:00:00Z').toISOString(),
      },
      status: null,
      metrics: {
        sonarPrice: BigInt('800000000'),
        sonarPriceInSui: 0.8,
        sonarPriceDisplay: '0.800 SUI',
        priceOverride: BigInt('750000000'),
        priceOverrideDisplay: '0.750 SUI',
        overrideActive: true,
        currentTier: 2,
        circulatingSupply: BigInt('38000000000000000'),
        lastSyncedAt: new Date('2025-01-01T00:00:00Z').toISOString(),
        sonarReserve: BigInt('4200000000000000'),
        suiReserve: BigInt('3100000000000000'),
      },
      sonarPriceInSui: 0.8,
      sonarPriceDisplay: '0.800',
      isPriceLoading: false,
      priceError: null,
      currentTier: 2,
      circulatingSupply: '38000000000000000',
      priceOverride: '750000000',
      overrideActive: true,
      lastSyncedAt: new Date('2025-01-01T00:00:00Z').toISOString(),
      sonarReserveBI: BigInt('4200000000000000'),
      suiReserveBI: BigInt('3100000000000000'),
      isStatusLoading: false,
      statusError: null,
      refetchPrice: () => Promise.resolve(),
      refetchStatus: () => Promise.resolve(),
      isLoading: false,
      error: null,
    }),
  };
});

const { KioskPriceCard } = await import('../KioskPriceCard');

describe('KioskPriceCard', () => {
  test('displays override metadata and circulating supply', () => {
    render(<KioskPriceCard />);

    expect(screen.getByText('0.800 SUI')).toBeInTheDocument();
    expect(screen.getByText(/Economic Tier:/)).toHaveTextContent('Economic Tier: 2 - Standard pricing');
    expect(screen.getByText(/Admin override price:/)).toHaveTextContent('0.750 SUI');
    expect(screen.getByText(/Circulating Supply:/)).toHaveTextContent('38000000.00 SONAR');
  });
});
