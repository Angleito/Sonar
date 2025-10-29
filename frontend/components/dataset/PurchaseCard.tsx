'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { SonarButton } from '@/components/ui/SonarButton';
import { SignalBadge } from '@/components/ui/SignalBadge';
import { getTierInfo, calculateBurnAmount, calculateCreatorReward } from '@/lib/tier-utils';
import { formatSonarAmount } from '@/lib/tier-utils';
import type { Dataset } from '@/types/blockchain';
import type { ProtocolStats } from '@/types/blockchain';

interface PurchaseCardProps {
  dataset: Dataset;
  stats?: ProtocolStats;
}

/**
 * PurchaseCard Component
 * Displays pricing, burn breakdown, and purchase button
 * Shows how the current tier affects the purchase economics
 */
export function PurchaseCard({ dataset, stats }: PurchaseCardProps) {
  const [isPurchasing, setIsPurchasing] = useState(false);

  const price = Number(dataset.price) / 1_000_000; // Convert from smallest units
  const currentTier = stats ? getTierInfo(stats.circulating_supply) : null;

  // Calculate burn and creator amounts
  const burnAmount = stats ? calculateBurnAmount(price, stats.circulating_supply) : price * 0.6;
  const creatorAmount = stats ? calculateCreatorReward(price, stats.circulating_supply) : price * 0.4;

  const handlePurchase = async () => {
    setIsPurchasing(true);

    // Placeholder for purchase transaction
    // Will integrate with @mysten/dapp-kit for actual wallet transactions
    setTimeout(() => {
      setIsPurchasing(false);
      alert('Purchase flow will be integrated with Sui wallet in the next phase');
    }, 1500);
  };

  return (
    <GlassCard className="sonar-glow">
      <h3 className="text-xl font-mono text-sonar-highlight mb-6">Purchase Dataset</h3>

      {/* Price Display */}
      <div className="text-center py-6 mb-6 bg-sonar-abyss/30 rounded-sonar border border-sonar-signal/20">
        <div className="text-5xl font-mono font-bold text-sonar-signal mb-2">
          {price.toFixed(2)}
        </div>
        <div className="text-sm text-sonar-highlight-bright/60 uppercase tracking-wide">
          SONAR
        </div>
      </div>

      {/* Current Tier Info */}
      {currentTier && (
        <div className="mb-6 p-4 bg-sonar-abyss/20 rounded-sonar border border-sonar-highlight/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-sonar-highlight-bright/70">Current Tier</span>
            <SignalBadge
              variant={currentTier.level === 1 ? 'error' : currentTier.level === 2 ? 'warning' : 'success'}
              className="text-xs"
            >
              Tier {currentTier.level}
            </SignalBadge>
          </div>
          <div className="text-xs text-sonar-highlight-bright/60">
            {currentTier.description}
          </div>
        </div>
      )}

      {/* Token Economics Breakdown */}
      <div className="space-y-3 mb-6">
        <h4 className="text-sm font-mono text-sonar-highlight-bright/70 mb-3">
          Purchase Breakdown
        </h4>

        {/* Burn Amount */}
        <div className="flex justify-between items-center py-3 bg-sonar-abyss/20 rounded-sonar px-4">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🔥</span>
            <span className="text-sm text-sonar-highlight-bright/70">Tokens Burned</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono text-sonar-coral font-bold">
              {burnAmount.toFixed(2)} SONAR
            </div>
            <div className="text-xs text-sonar-highlight-bright/50">
              {currentTier ? `${(currentTier.burnRate * 100).toFixed(0)}%` : '60%'}
            </div>
          </div>
        </div>

        {/* Creator Reward */}
        <div className="flex justify-between items-center py-3 bg-sonar-abyss/20 rounded-sonar px-4">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">👤</span>
            <span className="text-sm text-sonar-highlight-bright/70">Creator Receives</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono text-sonar-highlight font-bold">
              {creatorAmount.toFixed(2)} SONAR
            </div>
            <div className="text-xs text-sonar-highlight-bright/50">
              {currentTier ? `${((1 - currentTier.burnRate) * 100).toFixed(0)}%` : '40%'}
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Button */}
      {dataset.listed ? (
        <SonarButton
          variant="primary"
          onClick={handlePurchase}
          disabled={isPurchasing}
          className="w-full text-lg py-4"
        >
          {isPurchasing ? 'Processing...' : 'Purchase Dataset'}
        </SonarButton>
      ) : (
        <div className="text-center py-4">
          <SignalBadge variant="error">Unlisted</SignalBadge>
          <p className="text-xs text-sonar-highlight-bright/50 mt-2">
            This dataset is not currently available for purchase
          </p>
        </div>
      )}

      {/* What You Get */}
      <div className="mt-6 pt-6 border-t border-white/5">
        <h4 className="text-sm font-mono text-sonar-highlight-bright/70 mb-3">What You Get</h4>
        <ul className="space-y-2 text-xs text-sonar-highlight-bright/70">
          <li className="flex items-start">
            <span className="text-sonar-signal mr-2">✓</span>
            <span>Lifetime access to full audio dataset</span>
          </li>
          <li className="flex items-start">
            <span className="text-sonar-signal mr-2">✓</span>
            <span>All available formats ({dataset.formats.join(', ')})</span>
          </li>
          <li className="flex items-start">
            <span className="text-sonar-signal mr-2">✓</span>
            <span>Commercial use license</span>
          </li>
          <li className="flex items-start">
            <span className="text-sonar-signal mr-2">✓</span>
            <span>Decrypted via Mysten Seal (privacy-first)</span>
          </li>
          <li className="flex items-start">
            <span className="text-sonar-signal mr-2">✓</span>
            <span>{formatSonarAmount(dataset.sample_count)} audio samples</span>
          </li>
        </ul>
      </div>

      {/* Security Note */}
      <div className="mt-6 p-3 bg-sonar-signal/5 rounded-sonar border border-sonar-signal/20">
        <p className="text-xs text-sonar-highlight-bright/60">
          <span className="font-mono text-sonar-signal">🔒 Secure:</span> Purchase is recorded
          on Sui blockchain. Audio files are stored on Walrus with end-to-end encryption.
        </p>
      </div>
    </GlassCard>
  );
}
