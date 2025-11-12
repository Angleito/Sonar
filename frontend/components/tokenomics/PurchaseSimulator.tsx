'use client';

import { useState, useEffect } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { getTierInfo, type TierInfo } from '@/lib/tier-utils';
import { formatNumber } from '@/lib/utils';

interface PurchaseSimulatorProps {
  currentSupply: number;
  snrPriceUsd: number;
}

export function PurchaseSimulator({ currentSupply, snrPriceUsd }: PurchaseSimulatorProps) {
  const [datasetPrice, setDatasetPrice] = useState<string>('1000'); // Price in SNR tokens
  const [results, setResults] = useState<{
    datasetPrice: number;
    uploadBurn: number;
    purchaseBurn: number;
    totalBurned: number;
    creatorReceives: number;
    burnRate: number;
    newSupply: number;
    tierBefore: TierInfo;
    tierAfter: TierInfo;
    tierChanged: boolean;
  } | null>(null);

  useEffect(() => {
    const price = parseFloat(datasetPrice);
    if (isNaN(price) || price <= 0) {
      setResults(null);
      return;
    }

    // Calculate upload burn (0.001% of circulating supply)
    const uploadBurn = currentSupply * 0.00001;

    // Get current tier for purchase burn
    const tierBefore = getTierInfo(currentSupply);
    const burnRate = tierBefore.burnRate * 100; // Convert to percentage

    // Calculate purchase burn from dataset sale
    const purchaseBurn = price * tierBefore.burnRate;
    const creatorReceives = price - purchaseBurn;

    // Total burns from both upload and purchase
    const totalBurned = uploadBurn + purchaseBurn;

    // New supply after both burns
    const newSupply = currentSupply - totalBurned;
    const tierAfter = getTierInfo(newSupply);

    setResults({
      datasetPrice: price,
      uploadBurn,
      purchaseBurn,
      totalBurned,
      creatorReceives,
      burnRate,
      newSupply,
      tierBefore,
      tierAfter,
      tierChanged: tierBefore.level !== tierAfter.level,
    });
  }, [datasetPrice, currentSupply]);

  return (
    <GlassCard>
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-mono text-sonar-highlight">Dataset Lifecycle Simulator</h3>
            <span className="text-xs px-2 py-1 bg-sonar-signal/20 text-sonar-signal border border-sonar-signal/30 rounded-sonar">
              INTERACTIVE
            </span>
          </div>
          <p className="text-sm text-sonar-highlight-bright/70">
            SNR tokens are burned at TWO points: when creators upload datasets AND when buyers purchase them
          </p>
        </div>

        {/* Input */}
        <div>
          <label className="block text-sm font-mono text-sonar-highlight-bright/80 mb-2">
            Dataset Price (SNR tokens)
          </label>
          <div className="relative">
            <input
              type="number"
              value={datasetPrice}
              onChange={(e) => setDatasetPrice(e.target.value)}
              placeholder="1000"
              min="0"
              step="100"
              className="w-full pl-4 pr-16 py-3 bg-sonar-abyss/50 border border-sonar-signal/30 rounded-sonar text-sonar-highlight font-mono focus:outline-none focus:border-sonar-signal/60 focus:ring-2 focus:ring-sonar-signal/20 transition-all"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sonar-highlight-bright/50 font-mono">
              SNR
            </span>
          </div>
          <p className="text-xs text-sonar-highlight-bright/50 mt-1">
            When a user buys a dataset priced at this many SNR tokens
          </p>
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-4">
            {/* Tier Change Warning */}
            {results.tierChanged && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-sonar">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 text-yellow-400 flex-shrink-0">⚠️</div>
                  <div>
                    <p className="text-sm font-semibold text-yellow-400">Tier Change Detected!</p>
                    <p className="text-xs text-yellow-300/80 mt-1">
                      This purchase would trigger a tier change from Tier {results.tierBefore.level} to Tier {results.tierAfter.level}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Calculation Results */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-sonar">
                <p className="text-xs text-sonar-highlight-bright/60 mb-1 font-mono">Upload Burn</p>
                <p className="text-2xl font-mono font-bold text-yellow-400">
                  {formatNumber(results.uploadBurn)}
                </p>
                <p className="text-xs text-sonar-highlight-bright/50 mt-1">0.001% of supply</p>
              </div>

              <div className="p-4 bg-sonar-coral/10 border border-sonar-coral/30 rounded-sonar">
                <p className="text-xs text-sonar-highlight-bright/60 mb-1 font-mono">Purchase Burn</p>
                <p className="text-2xl font-mono font-bold text-sonar-coral">
                  {formatNumber(results.purchaseBurn)}
                </p>
                <p className="text-xs text-sonar-highlight-bright/50 mt-1">{results.burnRate.toFixed(0)}% of sale</p>
              </div>

              <div className="p-4 bg-sonar-signal/10 border border-sonar-signal/30 rounded-sonar">
                <p className="text-xs text-sonar-highlight-bright/60 mb-1 font-mono">Creator Receives</p>
                <p className="text-2xl font-mono font-bold text-sonar-signal">
                  {formatNumber(results.creatorReceives)}
                </p>
                <p className="text-xs text-sonar-highlight-bright/50 mt-1">After purchase burn</p>
              </div>

              <div className="p-4 bg-sonar-abyss/50 border border-white/10 rounded-sonar">
                <p className="text-xs text-sonar-highlight-bright/60 mb-1 font-mono">Total Burned</p>
                <p className="text-2xl font-mono font-bold text-sonar-highlight-bright">
                  {formatNumber(results.totalBurned)}
                </p>
                <p className="text-xs text-sonar-highlight-bright/50 mt-1">
                  {((results.totalBurned / currentSupply) * 100).toFixed(4)}% reduction
                </p>
              </div>
            </div>

            {/* Breakdown */}
            <div className="p-4 bg-sonar-abyss/30 border border-white/5 rounded-sonar space-y-2">
              <p className="text-xs font-mono text-sonar-highlight-bright/60 mb-2">Complete Lifecycle</p>
              <div className="space-y-2">
                <div className="pb-2 border-b border-white/5">
                  <p className="text-xs text-yellow-300/80 font-semibold mb-1">1. Upload Phase</p>
                  <div className="flex justify-between text-xs font-mono text-sonar-highlight-bright/70">
                    <span>Creator burns to list:</span>
                    <span className="text-yellow-400">-{formatNumber(results.uploadBurn)} SNR</span>
                  </div>
                </div>

                <div className="pb-2 border-b border-white/5">
                  <p className="text-xs text-sonar-coral font-semibold mb-1">2. Purchase Phase</p>
                  <div className="space-y-1 text-xs font-mono text-sonar-highlight-bright/70">
                    <div className="flex justify-between">
                      <span>Dataset Price:</span>
                      <span className="text-sonar-highlight">{formatNumber(results.datasetPrice)} SNR</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Purchase Burn ({results.burnRate.toFixed(0)}%):</span>
                      <span className="text-sonar-coral">-{formatNumber(results.purchaseBurn)} SNR</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Creator Receives:</span>
                      <span className="text-sonar-signal">{formatNumber(results.creatorReceives)} SNR</span>
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <div className="flex justify-between text-xs font-mono font-semibold">
                    <span>Total Ecosystem Burn:</span>
                    <span className="text-sonar-highlight-bright">{formatNumber(results.totalBurned)} SNR</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!results && datasetPrice && (
          <div className="text-center py-8 text-sonar-highlight-bright/50 text-sm">
            Enter a valid dataset price to see burn calculations
          </div>
        )}
      </div>
    </GlassCard>
  );
}
