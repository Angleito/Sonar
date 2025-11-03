/**
 * Kiosk Liquidity Purchase Flow
 * Handles both one-step (direct dataset purchase) and two-step (buy SONAR + dataset) flows
 */

'use client';

import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { toast } from 'sonner';
import { useKioskPrice } from '@/hooks/useKioskPrice';
import { useAuth } from '@/hooks/useAuth';
import { requestKioskAccessGrant } from '@/lib/api/client';
import { calculateSuiNeeded, formatBigIntAmount } from '@/lib/utils';
import type { Dataset } from '@/types/blockchain';

interface KioskPurchaseFlowProps {
  dataset: Dataset;
  onSuccess?: (txDigest: string) => void;
  onCancel?: () => void;
}

export function KioskPurchaseFlow({
  dataset,
  onSuccess,
  onCancel,
}: KioskPurchaseFlowProps) {
  const account = useCurrentAccount();
  const { token } = useAuth();
  const { price, isLoading: isPriceLoading } = useKioskPrice();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [step, setStep] = useState<'choose' | 'buy-sonar' | 'buy-dataset'>('choose');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!account) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <p className="text-sm text-red-200">Please connect your wallet to purchase</p>
      </div>
    );
  }

  if (isPriceLoading) {
    return (
      <div className="p-4 bg-gray-600/10 border border-gray-600/30 rounded-lg animate-pulse">
        <p className="text-sm text-gray-300">Loading kiosk price...</p>
      </div>
    );
  }

  if (!price) {
    return (
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <p className="text-sm text-yellow-200">Kiosk unavailable. Please try the marketplace instead.</p>
      </div>
    );
  }

  // Calculate SUI needed using BigInt-safe math
  // dataset.price is in SONAR base units (1e9 per SONAR)
  // price.sonar_price is price per SONAR in SUI base units
  const datasetPriceInSonar = BigInt(dataset.price);
  const sonarPriceInSuiBaseUnits = BigInt(price.sonar_price);
  const suiNeeded = calculateSuiNeeded(datasetPriceInSonar, sonarPriceInSuiBaseUnits);

  // One-step: direct dataset purchase
  const handleOneStepPurchase = async () => {
    if (suiNeeded === 0n || !account) return;

    try {
      setIsProcessing(true);

      // Build transaction for purchase_dataset_kiosk
      const txn = new Transaction();
      txn.moveCall({
        target: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::marketplace::purchase_dataset_kiosk_with_sui`,
        arguments: [
          txn.object(process.env.NEXT_PUBLIC_MARKETPLACE_ID!),
          txn.object(dataset.id),
          txn.splitCoins(txn.gas, [txn.pure.u64(suiNeeded)]),
        ],
      });

      const result = await signAndExecute({ transaction: txn });

      if (result.digest) {
        toast.success(`Dataset purchased! Transaction: ${result.digest.slice(0, 8)}...`);

        // Get access grant from kiosk endpoint
        if (token) {
          try {
            await requestKioskAccessGrant(dataset.id, token);
          } catch (err) {
            // Access grant will be available shortly after blockchain confirms
            console.error('Could not fetch access grant yet:', err);
          }
        }

        onSuccess?.(result.digest);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Purchase failed';
      toast.error(`Purchase failed: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Two-step: buy SONAR first
  const handleBuySonar = async () => {
    if (suiNeeded === 0n || !account) return;

    try {
      setIsProcessing(true);

      // Build transaction for sell_sonar (user perspective: they sell SUI to get SONAR)
      const txn = new Transaction();
      const suiWithGasBuffer = suiNeeded + BigInt(5_000_000); // Extra 0.005 SUI for gas
      txn.moveCall({
        target: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::marketplace::sell_sonar`,
        arguments: [
          txn.object(process.env.NEXT_PUBLIC_MARKETPLACE_ID!),
          txn.splitCoins(txn.gas, [txn.pure.u64(suiWithGasBuffer)]),
        ],
      });

      const result = await signAndExecute({ transaction: txn });

      if (result.digest) {
        toast.success(`SONAR purchased! Now buy the dataset...`);
        setStep('buy-dataset');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to buy SONAR';
      toast.error(`Failed: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Two-step: buy dataset after having SONAR
  const handleBuyDatasetStep2 = async () => {
    if (!account) return;

    try {
      setIsProcessing(true);

      // Build transaction for purchase_dataset
      const txn = new Transaction();
      txn.moveCall({
        target: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::marketplace::purchase_dataset`,
        arguments: [
          txn.object(process.env.NEXT_PUBLIC_MARKETPLACE_ID!),
          txn.object(dataset.id),
          // In real implementation, would select SONAR coin from wallet
          // Keep as BigInt to avoid precision loss
          txn.pure.u64(datasetPriceInSonar),
        ],
      });

      const result = await signAndExecute({ transaction: txn });

      if (result.digest) {
        toast.success(`Dataset purchased! Transaction: ${result.digest.slice(0, 8)}...`);

        // Get access grant
        if (token) {
          try {
            await requestKioskAccessGrant(dataset.id, token);
          } catch (err) {
            console.error('Could not fetch access grant yet:', err);
          }
        }

        onSuccess?.(result.digest);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Purchase failed';
      toast.error(`Purchase failed: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Render based on current step
  if (step === 'buy-sonar') {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-xs text-blue-200 mb-2">Step 1 of 2: Buy SONAR</p>
          <p className="text-sm text-blue-100">
            You need {formatBigIntAmount(datasetPriceInSonar, 9, 1)} SONAR ({formatBigIntAmount(suiNeeded, 9, 3)} SUI)
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleBuySonar}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg text-sm font-medium transition"
          >
            {isProcessing ? 'Processing...' : 'Buy SONAR'}
          </button>
          <button
            onClick={() => setStep('choose')}
            disabled={isProcessing}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 rounded-lg text-sm font-medium transition"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (step === 'buy-dataset') {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-xs text-green-200 mb-2">Step 2 of 2: Buy Dataset</p>
          <p className="text-sm text-green-100">
            Complete the purchase for {dataset.title}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleBuyDatasetStep2}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg text-sm font-medium transition"
          >
            {isProcessing ? 'Processing...' : 'Buy Dataset'}
          </button>
          <button
            onClick={() => setStep('choose')}
            disabled={isProcessing}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 rounded-lg text-sm font-medium transition"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Choose flow (one-step vs two-step)
  return (
    <div className="space-y-4">
      <div className="p-3 bg-gray-700/50 border border-gray-600/50 rounded-lg">
        <p className="text-xs text-gray-400 mb-2">Kiosk Liquidity Purchase</p>
        <p className="text-sm text-gray-100">
          {formatBigIntAmount(datasetPriceInSonar, 9, 1)} SONAR via kiosk
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Cost: {formatBigIntAmount(suiNeeded, 9, 3)} SUI
        </p>
      </div>

      <div className="space-y-2">
        <button
          onClick={handleOneStepPurchase}
          disabled={isProcessing || suiNeeded === 0n}
          title={
            suiNeeded === 0n
              ? 'Kiosk price not available'
              : 'Buy directly with SUI (1 transaction)'
          }
          className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg text-sm font-medium transition"
        >
          {isProcessing ? 'Processing...' : '1-Step: Buy Now'}
        </button>

        <button
          onClick={() => setStep('buy-sonar')}
          disabled={isProcessing || suiNeeded === 0n}
          title={
            suiNeeded === 0n
              ? 'Kiosk price not available'
              : 'Buy SONAR first, then dataset (2 transactions)'
          }
          className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 rounded-lg text-sm font-medium transition"
        >
          2-Step: Buy SONAR First
        </button>
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition"
        >
          Use Marketplace Instead
        </button>
      )}
    </div>
  );
}
