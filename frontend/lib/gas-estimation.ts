/**
 * Gas estimation utilities for Sonar transactions
 */

// Gas costs in MIST (1 SUI = 1,000,000,000 MIST)
export const GAS_COSTS = {
  // Base transaction costs
  SIMPLE_TRANSFER: 1_000_000,      // 0.001 SUI
  MOVE_CALL_SIMPLE: 5_000_000,     // 0.005 SUI
  MOVE_CALL_COMPLEX: 10_000_000,   // 0.01 SUI

  // Dataset operations
  DATASET_PUBLISH: 15_000_000,     // 0.015 SUI
  DATASET_PURCHASE: 10_000_000,    // 0.01 SUI
  DATASET_UPDATE: 8_000_000,       // 0.008 SUI

  // Sub-wallet operations
  SUBWALLET_FUND: 2_000_000,       // 0.002 SUI per wallet
  SUBWALLET_SWEEP: 2_000_000,      // 0.002 SUI per wallet

  // Walrus operations (estimated based on data size)
  WALRUS_STORE_BASE: 20_000_000,   // 0.02 SUI base
  WALRUS_STORE_PER_MB: 5_000_000,  // 0.005 SUI per MB
} as const;

/**
 * Calculate optimal wallet count based on total dataset size
 * Formula: 4 wallets per GB
 * Minimum: 4 wallets
 * Maximum: 100 wallets (safety cap)
 */
export function calculateWalletCount(files: File[]): number {
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const totalGB = totalBytes / (1024 * 1024 * 1024);

  // 4 wallets per GB, minimum 4, maximum 100
  return Math.min(Math.max(Math.ceil(totalGB * 4), 4), 100);
}

/**
 * Estimate gas for Walrus upload based on file size
 */
export function estimateWalrusGas(fileSizeBytes: number): bigint {
  const sizeMB = fileSizeBytes / (1024 * 1024);
  const gasEstimate = GAS_COSTS.WALRUS_STORE_BASE +
    Math.ceil(sizeMB) * GAS_COSTS.WALRUS_STORE_PER_MB;

  // Add 20% buffer for safety
  return BigInt(Math.ceil(gasEstimate * 1.2));
}

/**
 * Estimate total gas for multi-file dataset upload
 */
export function estimateDatasetUploadGas(files: File[]): {
  totalGas: bigint;
  perFileGas: bigint[];
  publishGas: bigint;
  breakdown: {
    walrusUpload: bigint;
    datasetPublish: bigint;
    total: bigint;
  };
} {
  const perFileGas = files.map(f => estimateWalrusGas(f.size));
  const walrusUploadGas = perFileGas.reduce((sum, gas) => sum + gas, 0n);
  const publishGas = BigInt(GAS_COSTS.DATASET_PUBLISH);

  return {
    totalGas: walrusUploadGas + publishGas,
    perFileGas,
    publishGas,
    breakdown: {
      walrusUpload: walrusUploadGas,
      datasetPublish: publishGas,
      total: walrusUploadGas + publishGas,
    },
  };
}

/**
 * Estimate costs for sub-wallet parallel upload
 * Scales dynamically: 4 wallets per GB
 */
export function estimateSubWalletCosts(files: File[]): {
  walletCount: number;
  totalSizeGB: number;
  fundingGas: bigint;
  sweepingGas: bigint;
  fundAmount: bigint;
  totalExtra: bigint;
} {
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const totalSizeGB = totalBytes / (1024 * 1024 * 1024);
  const walletCount = calculateWalletCount(files);

  const fundingGas = BigInt(walletCount * GAS_COSTS.SUBWALLET_FUND);
  const sweepingGas = BigInt(walletCount * GAS_COSTS.SUBWALLET_SWEEP);

  // Each wallet needs gas for its share of uploads
  const filesPerWallet = Math.ceil(files.length / walletCount);
  const fundAmount = BigInt(filesPerWallet * GAS_COSTS.WALRUS_STORE_BASE * 3); // 3x buffer

  return {
    walletCount,
    totalSizeGB: Math.round(totalSizeGB * 100) / 100, // 2 decimal places
    fundingGas,
    sweepingGas,
    fundAmount,
    totalExtra: fundingGas + sweepingGas,
  };
}

/**
 * Format gas amount for display
 */
export function formatGasCost(gasMist: bigint): string {
  const sui = Number(gasMist) / 1_000_000_000;

  if (sui < 0.001) {
    return `${(sui * 1000).toFixed(2)} mSUI`;
  } else if (sui < 1) {
    return `${sui.toFixed(3)} SUI`;
  } else {
    return `${sui.toFixed(2)} SUI`;
  }
}
