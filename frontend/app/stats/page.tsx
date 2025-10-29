'use client';

import { useProtocolStats } from '@/hooks/useProtocolStats';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { GlassCard } from '@/components/ui/GlassCard';
import { SonarBackground } from '@/components/animations/SonarBackground';
import { TierCard } from '@/components/economics/TierCard';
import { TokenEconomics } from '@/components/economics/TokenEconomics';
import { SupplyMetrics } from '@/components/economics/SupplyMetrics';
import { getTierInfo, getAllTierConfigs } from '@/lib/tier-utils';

/**
 * Economics Dashboard Page
 * Displays SONAR token economics, tier system, and protocol statistics
 */
export default function StatsPage() {
  const { data: stats, isLoading, error } = useProtocolStats();

  if (isLoading) {
    return (
      <main className="relative min-h-screen">
        <SonarBackground opacity={0.2} intensity={0.4} />
        <div className="relative z-10 container mx-auto px-6 py-12">
          <div className="flex justify-center items-center min-h-[60vh]">
            <LoadingSpinner />
          </div>
        </div>
      </main>
    );
  }

  if (error || !stats) {
    return (
      <main className="relative min-h-screen">
        <SonarBackground opacity={0.2} intensity={0.4} />
        <div className="relative z-10 container mx-auto px-6 py-12">
          <GlassCard className="text-center py-12">
            <p className="text-sonar-coral text-lg mb-2">Failed to load protocol statistics</p>
            <p className="text-sm text-sonar-highlight-bright/50">
              {error?.message || 'Unknown error'}
            </p>
          </GlassCard>
        </div>
      </main>
    );
  }

  const currentTier = getTierInfo(stats.circulating_supply);
  const allTiers = getAllTierConfigs();

  return (
    <main className="relative min-h-screen">
      {/* Background Animation */}
      <SonarBackground opacity={0.2} intensity={0.4} />

      <div className="relative z-10 container mx-auto px-6 py-12">
        {/* Page Header */}
        <div className="max-w-6xl mx-auto mb-12">
          <h1 className="text-5xl font-mono tracking-radar text-sonar-highlight mb-4">
            Token Economics
          </h1>
          <p className="text-xl text-sonar-highlight-bright/80">
            Adaptive burn model with absolute-threshold tiers
          </p>
        </div>

        <div className="max-w-6xl mx-auto space-y-8">
          {/* Current Tier Status */}
          <section>
            <h2 className="text-2xl font-mono text-sonar-highlight mb-6">Current Tier</h2>
            <TierCard tier={currentTier} stats={stats} highlighted />
          </section>

          {/* Token Economics Overview */}
          <section>
            <h2 className="text-2xl font-mono text-sonar-highlight mb-6">Token Economics</h2>
            <TokenEconomics stats={stats} currentTier={currentTier} />
          </section>

          {/* Supply Metrics */}
          <section>
            <h2 className="text-2xl font-mono text-sonar-highlight mb-6">Supply Metrics</h2>
            <SupplyMetrics stats={stats} currentTier={currentTier} />
          </section>

          {/* All Tiers Explanation */}
          <section>
            <h2 className="text-2xl font-mono text-sonar-highlight mb-6">Tier System</h2>
            <p className="text-sonar-highlight-bright/70 mb-6">
              SONAR uses an absolute-threshold dynamic burn model with 3 tiers. As the circulating
              supply decreases through burns, the protocol moves to lower tiers with reduced burn
              rates to preserve scarcity.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {allTiers.map((tier, index) => (
                <TierCard
                  key={tier.level}
                  tier={tier}
                  stats={stats}
                  highlighted={tier.level === currentTier.level}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
