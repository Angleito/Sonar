import { useState } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { toB64 } from '@mysten/sui/utils';

interface SubWallet {
  id: string;
  address: string;
  keypair: Ed25519Keypair;
}

export function useSubWallets() {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const [wallets, setWallets] = useState<SubWallet[]>([]);

  /**
   * Create ephemeral sub-wallets in browser memory
   * Keys stored in RAM only, discarded after sweep
   */
  const createEphemeralWallets = async (count: number): Promise<SubWallet[]> => {
    const created: SubWallet[] = [];

    for (let i = 0; i < count; i++) {
      const keypair = new Ed25519Keypair();
      const wallet = {
        id: `ephemeral-${Date.now()}-${i}`,
        address: keypair.getPublicKey().toSuiAddress(),
        keypair,
      };
      created.push(wallet);
    }

    setWallets(created);
    console.log(`Created ${count} ephemeral sub-wallets`);
    return created;
  };

  /**
   * Fund wallets from main wallet using dapp-kit signing
   * Sends SUI from user's connected wallet to each sub-wallet
   */
  const fundWallets = async (
    walletsToFund: SubWallet[],
    amountPerWallet: bigint,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> => {
    if (!currentAccount) {
      throw new Error('Wallet not connected');
    }

    console.log(`Funding ${walletsToFund.length} wallets with ${amountPerWallet} MIST each`);

    for (let i = 0; i < walletsToFund.length; i++) {
      const wallet = walletsToFund[i];

      // Build transaction
      const tx = new Transaction();
      tx.setSender(currentAccount.address);
      tx.setGasBudget(10_000_000); // 0.01 SUI gas budget

      // Split coins from gas and transfer to sub-wallet
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountPerWallet)]);
      tx.transferObjects([coin], tx.pure.address(wallet.address));

      // Sign and execute via dapp-kit (user's wallet signs)
      await signAndExecuteTransaction({ transaction: tx });

      if (onProgress) {
        onProgress(i + 1, walletsToFund.length);
      }
    }

    console.log(`Successfully funded ${walletsToFund.length} wallets`);
  };

  /**
   * Sweep funds back to main wallet using stored keypairs
   * Uses sub-wallet private keys to sign transactions
   * Keys are in memory from createEphemeralWallets
   */
  const sweepWallets = async (
    walletsToSweep: SubWallet[],
    onProgress?: (current: number, total: number) => void
  ): Promise<void> => {
    if (!currentAccount) {
      throw new Error('Wallet not connected');
    }

    console.log(`Sweeping ${walletsToSweep.length} wallets back to main wallet`);

    for (let i = 0; i < walletsToSweep.length; i++) {
      const wallet = walletsToSweep[i];

      try {
        // Build sweep transaction
        const tx = new Transaction();
        tx.setSender(wallet.address);
        tx.setGasBudget(5_000_000); // 0.005 SUI gas budget

        // Transfer all coins to main wallet
        // Note: This is a simplified version - production should get all coin objects
        tx.transferObjects([tx.gas], tx.pure.address(currentAccount.address));

        // Sign with sub-wallet's keypair (we have the private key!)
        const txBytes = await tx.build({ client: suiClient });
        const signatureData = await wallet.keypair.sign(txBytes);

        // Execute transaction
        await suiClient.executeTransactionBlock({
          transactionBlock: txBytes,
          signature: toB64(signatureData),
        });

        if (onProgress) {
          onProgress(i + 1, walletsToSweep.length);
        }
      } catch (error) {
        console.warn(`Failed to sweep wallet ${wallet.id}:`, error);
        // Continue with other wallets even if one fails
      }
    }

    console.log(`Sweep complete for ${walletsToSweep.length} wallets`);
  };

  /**
   * Clear wallets from memory (called after sweep)
   * Discards all ephemeral keys
   */
  const clearWallets = () => {
    console.log(`Clearing ${wallets.length} ephemeral wallets from memory`);
    setWallets([]);
  };

  return {
    wallets,
    createEphemeralWallets,
    fundWallets,
    sweepWallets,
    clearWallets,
  };
}
