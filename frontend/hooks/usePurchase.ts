import { useState } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import type { Dataset } from '@/types/blockchain';
import { CHAIN_CONFIG, SONAR_COIN_TYPE } from '@/lib/sui/client';
import { collectCoinsForAmount, prepareCoinPayment } from '@/lib/sui/coin-utils';
import { clearPurchaseCacheEntry } from '@/lib/sui/purchase-verification';

export interface PurchaseState {
  isPurchasing: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  digest: string | null;
}

export interface UsePurchaseReturn {
  purchaseDataset: (dataset: Dataset) => Promise<void>;
  state: PurchaseState;
  reset: () => void;
}

/**
 * usePurchase Hook
 * Handles dataset purchase transactions on Sui blockchain
 *
 * Features:
 * - Wallet connection check
 * - Transaction building with Move smart contract call
 * - Transaction signing and execution
 * - Success/error handling
 * - Transaction digest for tracking
 *
 * Usage:
 * ```tsx
 * const { purchaseDataset, state } = usePurchase();
 *
 * const handlePurchase = async () => {
 *   await purchaseDataset(dataset);
 *   if (state.isSuccess) {
 *     // Show success message
 *   }
 * };
 * ```
 */
export function usePurchase(): UsePurchaseReturn {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();

  const [state, setState] = useState<PurchaseState>({
    isPurchasing: false,
    isSuccess: false,
    isError: false,
    error: null,
    digest: null,
  });

  const reset = () => {
    setState({
      isPurchasing: false,
      isSuccess: false,
      isError: false,
      error: null,
      digest: null,
    });
  };

  const purchaseDataset = async (dataset: Dataset) => {
    // Check wallet connection
    if (!currentAccount) {
      setState({
        isPurchasing: false,
        isSuccess: false,
        isError: true,
        error: new Error('Please connect your wallet first'),
        digest: null,
      });
      return;
    }

    setState({
      isPurchasing: true,
      isSuccess: false,
      isError: false,
      error: null,
      digest: null,
    });

    try {
      if (!CHAIN_CONFIG.configured || !CHAIN_CONFIG.packageId || !CHAIN_CONFIG.marketplaceId) {
        const missing =
          CHAIN_CONFIG.missingKeys.length > 0
            ? CHAIN_CONFIG.missingKeys.join(', ')
            : 'PACKAGE_ID / MARKETPLACE_ID';
        throw new Error(
          `Blockchain configuration incomplete (${missing}). Update NEXT_PUBLIC_* env vars or deployment defaults.`
        );
      }

      if (!SONAR_COIN_TYPE) {
        throw new Error('SONAR coin type is not configured.');
      }

      const requiredAmount = dataset.price;

      if (requiredAmount <= 0n) {
        throw new Error('Invalid dataset price.');
      }

      const accountAddress = currentAccount.address;

      const { coins, total } = await collectCoinsForAmount(
        suiClient,
        accountAddress,
        SONAR_COIN_TYPE,
        requiredAmount
      );

      if (total < requiredAmount) {
        throw new Error('Insufficient SONAR balance. Acquire SNR first.');
      }

      // Build transaction
      const tx = new Transaction();

      const paymentCoin = prepareCoinPayment({
        tx,
        owner: accountAddress,
        coins,
        total,
        required: requiredAmount,
      });

      tx.setGasBudget(10_000_000); // 0.01 SUI

      console.log('Purchase transaction built:', {
        dataset: dataset.id,
        price: dataset.price,
        buyer: currentAccount.address,
      });

      // Sign and execute transaction
      tx.moveCall({
        target: `${CHAIN_CONFIG.packageId}::marketplace::purchase_dataset`,
        arguments: [
          tx.object(CHAIN_CONFIG.marketplaceId),
          tx.object(dataset.id),
          paymentCoin,
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: tx,
      });

      console.log('Transaction result:', result);

      setState({
        isPurchasing: false,
        isSuccess: true,
        isError: false,
        error: null,
        digest: result.digest,
      });

      // Clear cached ownership checks so UI can unlock immediately
      try {
        clearPurchaseCacheEntry(currentAccount.address, dataset.id);
      } catch (cacheError) {
        console.warn('[usePurchase] Failed to clear purchase cache', cacheError);
      }

      // Note: In production, you would:
      // 1. Wait for transaction confirmation
      // 2. Update local state/cache
      // 3. Trigger data refetch
      // 4. Show success notification with explorer link
    } catch (error) {
      console.error('Purchase failed:', error);

      setState({
        isPurchasing: false,
        isSuccess: false,
        isError: true,
        error: error as Error,
        digest: null,
      });
    }
  };

  return {
    purchaseDataset,
    state,
    reset,
  };
}
