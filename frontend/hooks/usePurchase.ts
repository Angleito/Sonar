import { useState } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import type { Dataset } from '@/types/blockchain';
import { MARKETPLACE_ID, PACKAGE_ID, SONAR_COIN_TYPE } from '@/lib/sui/client';
import { collectCoinsForAmount, prepareCoinPayment } from '@/lib/sui/coin-utils';

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
      if (!MARKETPLACE_ID || MARKETPLACE_ID === '0x0') {
        throw new Error('Marketplace ID is not configured. Set NEXT_PUBLIC_MARKETPLACE_ID.');
      }

      if (!PACKAGE_ID || PACKAGE_ID === '0x0') {
        throw new Error('Package ID is not configured. Set NEXT_PUBLIC_PACKAGE_ID.');
      }

      if (SONAR_COIN_TYPE === '0x0::sonar::SONAR') {
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
        throw new Error('Insufficient SONAR balance. Use the kiosk flow to acquire SONAR first.');
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
        target: `${PACKAGE_ID}::marketplace::purchase_dataset`,
        arguments: [
          tx.object(MARKETPLACE_ID),
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
