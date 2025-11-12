'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import { SonarBackground } from '@/components/animations/SonarBackground';
import { TierCard } from '@/components/economics/TierCard';
import { TokenEconomics } from '@/components/economics/TokenEconomics';
import { SupplyMetrics } from '@/components/economics/SupplyMetrics';
import { PurchaseSimulator } from '@/components/tokenomics/PurchaseSimulator';
import { TimeSimulation } from '@/components/tokenomics/TimeSimulation';
import { ScenarioExplorer } from '@/components/tokenomics/ScenarioExplorer';
import { getTierInfo, getAllTierConfigs } from '@/lib/tier-utils';
import type { ProtocolStats } from '@/types/blockchain';

/**
 * Tokenomics Dashboard Page
 * Interactive demonstration of SNR token burn mechanisms
 * All data is mock/demo for hackathon showcase
 */
export default function TokenomicsPage() {
  // Mock SNR token data for demonstration
  const mockSNR = {
    initialSupply: 80000000, // 80M SNR
    circulatingSupply: 75000000, // 75M SNR (for interactive demos)
    circulatingSupplyBigInt: BigInt(75000000), // For ProtocolStats type
    totalBurned: 5000000, // 5M SNR burned
    totalBurnedBigInt: BigInt(5000000), // For ProtocolStats type
    priceUsd: 0.05, // $0.05 per SNR
  };

  // Mock protocol stats for display
  const mockStats: ProtocolStats = {
    circulating_supply: mockSNR.circulatingSupplyBigInt,
    initial_supply: BigInt(mockSNR.initialSupply),
    total_burned: mockSNR.totalBurnedBigInt,
    current_tier: 1,
    burn_rate: 60,
    liquidity_rate: 20,
    uploader_rate: 15,
    total_datasets: 47,
    total_purchases: 156,
    active_creators: 23,
    total_volume: BigInt(12450),
  };

  const currentTier = getTierInfo(mockSNR.circulatingSupply);
  const allTiers = getAllTierConfigs();

  return (
    <main className="relative min-h-screen">
      {/* Background Animation */}
      <SonarBackground opacity={0.2} intensity={0.4} />

      <div className="relative z-10 container mx-auto px-6 py-12">
        {/* Page Header */}
        <div className="max-w-6xl mx-auto mb-12">
          <h1 className="text-5xl font-mono tracking-radar text-sonar-highlight mb-4">
            SNR Tokenomics
          </h1>
          <div className="space-y-3">
            <p className="text-xl text-sonar-highlight-bright/80">
              Dual-burn tokenomics: SNR burns on upload AND purchase
            </p>
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-sonar-signal/10 border border-sonar-signal/30 rounded-sonar">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <p className="text-sm text-sonar-highlight-bright/90">
                <span className="font-semibold">Demo Mode:</span> Token not yet launched • Currently in hackathon phase • Finalizing launch details
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto space-y-8">
          {/* Interactive Demos Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-mono text-sonar-highlight">Interactive Burn Demos</h2>
              <span className="text-xs px-3 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-sonar font-mono">
                EXAMPLE DATA
              </span>
            </div>
            <p className="text-sm text-sonar-highlight-bright/70 mb-6">
              SNR tokens burn at two critical points: when creators upload datasets (0.001% of supply) and when buyers purchase them (tier-based %)
            </p>

            {/* Purchase Simulator */}
            <div className="mb-6">
              <PurchaseSimulator
                currentSupply={mockSNR.circulatingSupply}
                snrPriceUsd={mockSNR.priceUsd}
              />
            </div>

            {/* Time-based Simulation */}
            <div className="mb-6">
              <TimeSimulation
                initialSupply={mockSNR.circulatingSupply}
                snrPriceUsd={mockSNR.priceUsd}
              />
            </div>

            {/* Scenario Explorer */}
            <div>
              <ScenarioExplorer
                defaultInitialSupply={mockSNR.initialSupply}
                snrPriceUsd={mockSNR.priceUsd}
              />
            </div>
          </section>

          {/* Current Tier Status */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-mono text-sonar-highlight">Example Current Tier</h2>
              <span className="text-xs px-3 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-sonar font-mono">
                HYPOTHETICAL
              </span>
            </div>
            <TierCard
              tier={currentTier}
              stats={mockStats}
              highlighted
            />
          </section>

          {/* Token Economics Overview */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-mono text-sonar-highlight">SNR Token Economics</h2>
              <span className="text-xs px-3 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-sonar font-mono">
                HYPOTHETICAL
              </span>
            </div>
            <TokenEconomics
              stats={mockStats}
              currentTier={currentTier}
            />
          </section>

          {/* Supply Metrics */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-mono text-sonar-highlight">Supply Metrics</h2>
              <span className="text-xs px-3 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-sonar font-mono">
                HYPOTHETICAL
              </span>
            </div>
            <SupplyMetrics
              stats={mockStats}
              currentTier={currentTier}
            />
          </section>

          {/* All Tiers Explanation */}
          <section>
            <h2 className="text-2xl font-mono text-sonar-highlight mb-6">Tier System</h2>
            <p className="text-sonar-highlight-bright/70 mb-6">
              SNR would use an absolute-threshold dynamic burn model with 3 tiers. As the circulating
              supply decreases through burns, the protocol moves to lower tiers with reduced burn
              rates to preserve scarcity and ensure long-term sustainability.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {allTiers.map((tier, index) => (
                <TierCard
                  key={tier.level}
                  tier={tier}
                  stats={mockStats}
                  highlighted={tier.level === currentTier.level}
                />
              ))}
            </div>
          </section>

          {/* Example Protocol Activity */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-mono text-sonar-highlight">Example Protocol Activity</h2>
              <span className="text-xs px-3 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-sonar font-mono">
                DEMO DATA
              </span>
            </div>
            <GlassCard>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-sonar-highlight-bright/60 mb-2 font-mono">Total Datasets</p>
                  <p className="text-3xl font-mono font-bold text-sonar-signal">{mockStats.total_datasets}</p>
                </div>
                <div>
                  <p className="text-sm text-sonar-highlight-bright/60 mb-2 font-mono">Total Purchases</p>
                  <p className="text-3xl font-mono font-bold text-sonar-highlight">{mockStats.total_purchases}</p>
                </div>
                <div>
                  <p className="text-sm text-sonar-highlight-bright/60 mb-2 font-mono">Active Creators</p>
                  <p className="text-3xl font-mono font-bold text-sonar-highlight-bright">{mockStats.active_creators}</p>
                </div>
                <div>
                  <p className="text-sm text-sonar-highlight-bright/60 mb-2 font-mono">Total Volume</p>
                  <p className="text-3xl font-mono font-bold text-sonar-coral">${Number(mockStats.total_volume).toLocaleString()}</p>
                </div>
              </div>
              <p className="text-xs text-sonar-highlight-bright/50 mt-4 text-center">
                Example metrics showing how protocol activity would be displayed
              </p>
            </GlassCard>
          </section>
        </div>
      </div>
    </main>
  );
}
