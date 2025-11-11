'use client';

import { useState, useCallback } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { toast } from 'sonner';
import { CHAIN_CONFIG } from '@/lib/sui/client';

export interface UseVotingOptions {
  submissionId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface UseVotingResult {
  vote: (isUpvote: boolean) => Promise<void>;
  removeVote: (wasUpvote: boolean) => Promise<void>;
  isVoting: boolean;
  isRemoving: boolean;
}

/**
 * Hook for voting on audio submissions
 * Handles on-chain transactions via Sui wallet
 */
export function useVoting({ submissionId, onSuccess, onError }: UseVotingOptions): UseVotingResult {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [isVoting, setIsVoting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const vote = useCallback(async (isUpvote: boolean) => {
    if (!currentAccount) {
      toast.error('Please connect your wallet to vote');
      return;
    }

    if (!CHAIN_CONFIG.packageId) {
      toast.error('Blockchain configuration missing PACKAGE_ID');
      return;
    }

    setIsVoting(true);

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${CHAIN_CONFIG.packageId}::marketplace::vote_on_submission`,
        arguments: [
          tx.object(submissionId),
          tx.pure.bool(isUpvote),
        ],
      });

      const result = await signAndExecute({
        transaction: tx,
      });

      if (!('digest' in result) || !result.digest) {
        throw new Error('Transaction failed');
      }

      toast.success(isUpvote ? 'Upvoted!' : 'Downvoted!');
      onSuccess?.();
    } catch (error: any) {
      console.error('Vote error:', error);

      // Handle specific error cases
      if (error.message?.includes('E_CANNOT_VOTE_OWN_SUBMISSION')) {
        toast.error('You cannot vote on your own submission');
      } else if (error.message?.includes('rejected')) {
        toast.error('Transaction rejected');
      } else {
        toast.error('Failed to submit vote');
      }

      onError?.(error);
    } finally {
      setIsVoting(false);
    }
  }, [currentAccount, submissionId, signAndExecute, onSuccess, onError]);

  const removeVote = useCallback(async (wasUpvote: boolean) => {
    if (!currentAccount) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!CHAIN_CONFIG.packageId) {
      toast.error('Blockchain configuration missing PACKAGE_ID');
      return;
    }

    setIsRemoving(true);

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${CHAIN_CONFIG.packageId}::marketplace::remove_vote`,
        arguments: [
          tx.object(submissionId),
          tx.pure.bool(wasUpvote),
        ],
      });

      const result = await signAndExecute({
        transaction: tx,
      });

      if (!('digest' in result) || !result.digest) {
        throw new Error('Transaction failed');
      }

      toast.success('Vote removed');
      onSuccess?.();
    } catch (error: any) {
      console.error('Remove vote error:', error);

      if (error.message?.includes('E_VOTE_NOT_FOUND')) {
        toast.error('You have not voted on this submission');
      } else if (error.message?.includes('rejected')) {
        toast.error('Transaction rejected');
      } else {
        toast.error('Failed to remove vote');
      }

      onError?.(error);
    } finally {
      setIsRemoving(false);
    }
  }, [currentAccount, submissionId, signAndExecute, onSuccess, onError]);

  return {
    vote,
    removeVote,
    isVoting,
    isRemoving,
  };
}
