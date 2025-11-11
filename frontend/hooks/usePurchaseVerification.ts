'use client';

import { useState, useCallback } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { suiClient, PACKAGE_ID } from '@/lib/sui/client';
import { verifyUserOwnsDataset, clearPurchaseCacheEntry } from '@/lib/sui/purchase-verification';

/**
 * React hook for purchase verification
 * Provides methods to check if user owns a dataset
 */
export function usePurchaseVerification() {
  const account = useCurrentAccount();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Verify if current user owns a dataset
   */
  const verifyOwnership = useCallback(
    async (datasetId: string): Promise<boolean> => {
      if (!account?.address) {
        setError('Wallet not connected');
        return false;
      }

      setIsVerifying(true);
      setError(null);

      try {
        const owns = await verifyUserOwnsDataset(
          account.address,
          datasetId,
          suiClient,
          PACKAGE_ID
        );

        return owns;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Verification failed';
        setError(errorMessage);
        console.error('[usePurchaseVerification] Verification error:', err);
        return false;
      } finally {
        setIsVerifying(false);
      }
    },
    [account?.address]
  );

  /**
   * Clear cache for specific dataset (after purchase)
   */
  const clearCache = useCallback(
    (datasetId: string) => {
      if (account?.address) {
        clearPurchaseCacheEntry(account.address, datasetId);
      }
    },
    [account?.address]
  );

  return {
    verifyOwnership,
    clearCache,
    isVerifying,
    error,
    isConnected: !!account?.address,
  };
}
