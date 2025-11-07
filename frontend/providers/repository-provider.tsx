'use client';

import { createContext, useContext, useMemo } from 'react';
import type { DataRepository } from '@/lib/data/repository';
import { SeedDataRepository } from '@/lib/data/seed-repository';
import { SuiRepository } from '@/lib/data/sui-repository';
import { FreeSoundRepository } from '@/lib/data/freesound-repository';
import { USE_BLOCKCHAIN } from '@/lib/sui/client';

const RepositoryContext = createContext<DataRepository | null>(null);

const USE_FREESOUND = process.env.NEXT_PUBLIC_USE_FREESOUND === 'true';

/**
 * Repository Provider
 * Provides data repository to the entire app
 * Switches between seed data, freesound, and blockchain based on environment variables
 */
export function RepositoryProvider({ children }: { children: React.ReactNode }) {
  const repository = useMemo(() => {
    if (USE_FREESOUND) {
      console.log('Using Freesound repository (with Walrus caching)');
      return new FreeSoundRepository({ bundleSize: 10 });
    } else if (USE_BLOCKCHAIN) {
      console.log('Using Sui blockchain repository');
      return new SuiRepository();
    } else {
      console.log('Using seed data repository');
      return new SeedDataRepository();
    }
  }, []);

  return (
    <RepositoryContext.Provider value={repository}>
      {children}
    </RepositoryContext.Provider>
  );
}

/**
 * Hook to access the repository
 * Must be used within RepositoryProvider
 */
export function useRepository(): DataRepository {
  const repository = useContext(RepositoryContext);

  if (!repository) {
    throw new Error('useRepository must be used within RepositoryProvider');
  }

  return repository;
}
