'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Upload, Shield, CheckCircle, Wallet, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AudioFile, EncryptionResult, FileUploadResult, DatasetMetadata } from '@/lib/types/upload';
import { GlassCard } from '@/components/ui/GlassCard';
import { useSealEncryption } from '@/hooks/useSeal';
import { useWalrusUpload, generatePreviewBlob } from '@/hooks/useWalrusUpload';
import { useSubWallets } from '@/hooks/useSubWallets';
import { calculateWalletCount } from '@/lib/gas-estimation';

interface EncryptionStepProps {
  audioFile: AudioFile; // Backwards compatibility (single file)
  audioFiles?: AudioFile[]; // Multi-file support
  metadata?: DatasetMetadata; // For accessing fastUploadEnabled
  onEncrypted: (result: EncryptionResult & {
    walrusBlobId: string;
    previewBlobId?: string;
    files?: FileUploadResult[]; // Per-file results for multi-file
    bundleDiscountBps?: number;
  }) => void;
  onError: (error: string) => void;
}

type EncryptionStage =
  | 'creating-wallets'
  | 'funding-wallets'
  | 'encrypting'
  | 'generating-preview'
  | 'uploading-walrus'
  | 'sweeping-wallets'
  | 'finalizing'
  | 'completed';

/**
 * EncryptionStep Component
 * Handles client-side Seal encryption and Walrus upload
 */
export function EncryptionStep({
  audioFile,
  audioFiles = [],
  metadata,
  onEncrypted,
  onError,
}: EncryptionStepProps) {
  const filesToProcess = audioFiles.length > 0 ? audioFiles : [audioFile];
  const isMultiFile = audioFiles.length > 0;
  const isFastUploadEnabled = metadata?.fastUploadEnabled && isMultiFile;

  const [stage, setStage] = useState<EncryptionStage>('encrypting');
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [completedFiles, setCompletedFiles] = useState<FileUploadResult[]>([]);
  const [walletProgress, setWalletProgress] = useState({ current: 0, total: 0 });

  const { isReady, encrypt, error: sealError } = useSealEncryption();
  const { uploadWithPreview } = useWalrusUpload();
  const {
    wallets,
    createEphemeralWallets,
    fundWallets,
    sweepWallets,
    clearWallets,
  } = useSubWallets();

  useEffect(() => {
    if (isReady) {
      if (isFastUploadEnabled) {
        performParallelUpload();
      } else {
        performEncryptionAndUpload();
      }
    }
  }, [isReady]);

  useEffect(() => {
    if (sealError) {
      onError(sealError);
    }
  }, [sealError]);

  const performParallelUpload = async () => {
    try {
      const totalFiles = filesToProcess.length;
      const files = filesToProcess.map(f => f.file);
      const walletCount = calculateWalletCount(files);

      // Stage 1: Create ephemeral wallets
      setStage('creating-wallets');
      setProgress(5);
      const subWallets = await createEphemeralWallets(walletCount);
      setProgress(10);

      // Stage 2: Fund wallets from main wallet
      setStage('funding-wallets');
      const fundAmount = BigInt(50_000_000); // 0.05 SUI per wallet for uploads
      await fundWallets(subWallets, fundAmount, (current, total) => {
        setWalletProgress({ current, total });
        setProgress(10 + (current / total) * 15);
      });
      setProgress(25);

      // Stage 3: Parallel encryption and upload
      setStage('encrypting');
      const results: FileUploadResult[] = [];

      // Distribute files across wallets
      const filesPerWallet = Math.ceil(totalFiles / walletCount);
      const batches: AudioFile[][] = [];
      for (let i = 0; i < walletCount; i++) {
        const start = i * filesPerWallet;
        const end = Math.min(start + filesPerWallet, totalFiles);
        if (start < totalFiles) {
          batches.push(filesToProcess.slice(start, end));
        }
      }

      // Process batches in parallel
      const batchPromises = batches.map(async (batch, batchIndex) => {
        const batchResults: FileUploadResult[] = [];

        for (let i = 0; i < batch.length; i++) {
          const file = batch[i];
          const globalIndex = batchIndex * filesPerWallet + i;

          setCurrentFileIndex(globalIndex);

          // Encrypt
          const encryptionResult = await encrypt(
            file.file,
            { accessPolicy: 'purchase' },
            (progressPercent) => {
              const baseProgress = 25 + (globalIndex / totalFiles) * 30;
              setProgress(baseProgress + (progressPercent * 30) / totalFiles);
            }
          );

          // Generate preview
          setStage('generating-preview');
          const previewBlob = await generatePreviewBlob(file);

          // Upload to Walrus
          setStage('uploading-walrus');
          const uploadData = {
            encryptedBlob: new Blob([new Uint8Array(encryptionResult.encryptedData)]),
            seal_policy_id: encryptionResult.identity,
            backupKey: encryptionResult.backupKey,
            metadata: encryptionResult.metadata,
          };

          const walrusResult = await uploadWithPreview(uploadData, previewBlob);

          batchResults.push({
            fileId: file.id!,
            blobId: walrusResult.blobId,
            previewBlobId: walrusResult.previewBlobId,
            seal_policy_id: encryptionResult.identity,
            backupKey: encryptionResult.backupKey,
            duration: file.duration,
          });
        }

        return batchResults;
      });

      const batchResultsArrays = await Promise.all(batchPromises);
      results.push(...batchResultsArrays.flat());
      setCompletedFiles(results);
      setProgress(70);

      // Stage 4: Sweep funds back to main wallet
      setStage('sweeping-wallets');
      await sweepWallets(subWallets, (current, total) => {
        setWalletProgress({ current, total });
        setProgress(70 + (current / total) * 15);
      });
      setProgress(85);

      // Clear wallets from memory
      clearWallets();

      // Stage 5: Finalize
      setStage('finalizing');
      setProgress(90);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setProgress(100);

      // Prepare final result
      const bundleDiscountBps = totalFiles >= 6 ? 2000 : totalFiles >= 2 ? 1000 : 0;
      const finalResult = {
        encryptedBlob: new Blob(),
        seal_policy_id: results[0].seal_policy_id,
        backupKey: results[0].backupKey,
        metadata: {} as any, // Will be populated with actual metadata
        previewBlob: new Blob(),
        walrusBlobId: results[0].blobId,
        previewBlobId: results[0].previewBlobId,
        files: results,
        bundleDiscountBps,
      };

      setStage('completed');
      setTimeout(() => {
        onEncrypted(finalResult);
      }, 1000);

    } catch (error) {
      console.error('Parallel upload failed:', error);
      clearWallets(); // Clean up on error
      onError(error instanceof Error ? error.message : 'Parallel upload failed');
    }
  };

  const performEncryptionAndUpload = async () => {
    try {
      const results: FileUploadResult[] = [];
      const totalFiles = filesToProcess.length;
      let lastEncryptionResult: any = null;

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        setCurrentFileIndex(i);

        // Calculate base progress for this file
        const fileBaseProgress = (i / totalFiles) * 100;
        const fileProgressRange = 100 / totalFiles;

        // Stage 1: Encrypt audio with Mysten Seal
        setStage('encrypting');
        setProgress(fileBaseProgress);

        const encryptionResult = await encrypt(
          file.file,
          {
            accessPolicy: 'purchase', // Default to purchase policy
          },
          (progressPercent, statusMessage) => {
            const overallProgress = fileBaseProgress + (progressPercent * fileProgressRange * 0.25);
            setProgress(overallProgress);
            console.log(`[${i + 1}/${totalFiles}] ${statusMessage}`);
          }
        );

        const progressAfterEncryption = fileBaseProgress + (fileProgressRange * 0.25);
        setProgress(progressAfterEncryption);

        // Stage 2: Generate preview blob (first 30 seconds, lower quality)
        setStage('generating-preview');
        setProgress(progressAfterEncryption + (fileProgressRange * 0.05));

        const previewBlob = await generatePreviewBlob(file);
        setProgress(progressAfterEncryption + (fileProgressRange * 0.2));

        // Stage 3: Upload to Walrus via Edge Function
        setStage('uploading-walrus');

        // Transform SEAL result to upload format
        const uploadData = {
          encryptedBlob: new Blob([new Uint8Array(encryptionResult.encryptedData)]),
          seal_policy_id: encryptionResult.identity,
          backupKey: encryptionResult.backupKey,
          metadata: encryptionResult.metadata,
        };

        const walrusResult = await uploadWithPreview(uploadData, previewBlob);
        setProgress(progressAfterEncryption + (fileProgressRange * 0.7));

        // Store file result
        results.push({
          fileId: file.id!,
          blobId: walrusResult.blobId,
          previewBlobId: walrusResult.previewBlobId,
          seal_policy_id: encryptionResult.identity,
          backupKey: encryptionResult.backupKey,
          duration: file.duration,
        });

        // Store last encryption result for metadata
        lastEncryptionResult = encryptionResult;

        setCompletedFiles(results);
      }

      // Stage 4: Finalize
      setStage('finalizing');
      setProgress(90);

      await new Promise((resolve) => setTimeout(resolve, 500));
      setProgress(100);

      // Prepare final result
      if (isMultiFile) {
        // Multi-file result
        // Calculate bundle discount: 10% for 2-5 files, 20% for 6+ files
        const bundleDiscountBps = totalFiles >= 6 ? 2000 : totalFiles >= 2 ? 1000 : 0;

        const finalResult = {
          encryptedBlob: new Blob(), // Not used in multi-file mode
          seal_policy_id: results[0].seal_policy_id, // First file's policy
          backupKey: results[0].backupKey, // First file's backup key
          metadata: lastEncryptionResult!.metadata,
          previewBlob: new Blob(), // Not used
          walrusBlobId: results[0].blobId, // First file for backwards compat
          previewBlobId: results[0].previewBlobId,
          files: results,
          bundleDiscountBps,
        };

        setStage('completed');
        setTimeout(() => {
          onEncrypted(finalResult);
        }, 1000);
      } else {
        // Single file result (backwards compatibility)
        const result = results[0];
        const finalResult = {
          encryptedBlob: new Blob([new Uint8Array(lastEncryptionResult!.encryptedData)]),
          seal_policy_id: result.seal_policy_id,
          backupKey: result.backupKey,
          metadata: lastEncryptionResult!.metadata,
          previewBlob: await generatePreviewBlob(filesToProcess[0]),
          walrusBlobId: result.blobId,
          previewBlobId: result.previewBlobId,
        };

        setStage('completed');
        setTimeout(() => {
          onEncrypted(finalResult);
        }, 1000);
      }

    } catch (error) {
      console.error('Encryption or upload failed:', error);
      onError(error instanceof Error ? error.message : 'Encryption or upload failed');
    }
  };

  const stages: Array<{ key: EncryptionStage; label: string; icon: React.ReactNode }> = isFastUploadEnabled
    ? [
        {
          key: 'creating-wallets',
          label: 'Creating Sub-Wallets',
          icon: <Wallet className="w-5 h-5" />,
        },
        {
          key: 'funding-wallets',
          label: 'Funding Sub-Wallets',
          icon: <Coins className="w-5 h-5" />,
        },
        {
          key: 'encrypting',
          label: 'Encrypting with Mysten Seal',
          icon: <Lock className="w-5 h-5" />,
        },
        {
          key: 'generating-preview',
          label: 'Generating Previews',
          icon: <Shield className="w-5 h-5" />,
        },
        {
          key: 'uploading-walrus',
          label: 'Uploading to Walrus (Parallel)',
          icon: <Upload className="w-5 h-5" />,
        },
        {
          key: 'sweeping-wallets',
          label: 'Sweeping Funds Back',
          icon: <Coins className="w-5 h-5" />,
        },
        {
          key: 'finalizing',
          label: 'Finalizing',
          icon: <CheckCircle className="w-5 h-5" />,
        },
      ]
    : [
        {
          key: 'encrypting',
          label: 'Encrypting with Mysten Seal',
          icon: <Lock className="w-5 h-5" />,
        },
        {
          key: 'generating-preview',
          label: 'Generating Preview',
          icon: <Shield className="w-5 h-5" />,
        },
        {
          key: 'uploading-walrus',
          label: 'Uploading to Walrus',
          icon: <Upload className="w-5 h-5" />,
        },
        {
          key: 'finalizing',
          label: 'Finalizing',
          icon: <CheckCircle className="w-5 h-5" />,
        },
      ];

  const currentStageIndex = stages.findIndex((s) => s.key === stage);

  return (
    <div className="space-y-6">
      {/* Progress Circle */}
      <div className="flex flex-col items-center justify-center py-8">
        <div className="relative w-48 h-48">
          {/* Background Circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-sonar-blue/20"
            />
            {/* Progress Circle */}
            <motion.circle
              cx="96"
              cy="96"
              r="88"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={552.92} // 2 * PI * 88
              strokeDashoffset={552.92 * (1 - progress / 100)}
              strokeLinecap="round"
              className="text-sonar-signal"
              initial={{ strokeDashoffset: 552.92 }}
              animate={{ strokeDashoffset: 552.92 * (1 - progress / 100) }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            />
          </svg>

          {/* Center Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.div
              key={stage}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-sonar-signal mb-2"
            >
              {stages[currentStageIndex]?.icon}
            </motion.div>
            <motion.div
              key={`progress-${Math.floor(progress)}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-mono font-bold text-sonar-highlight-bright"
            >
              {Math.round(progress)}%
            </motion.div>
          </div>
        </div>

        {/* Current Stage Label */}
        <motion.p
          key={stage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 text-lg font-mono text-sonar-highlight-bright"
        >
          {stages[currentStageIndex]?.label}
        </motion.p>

        {/* Multi-file progress indicator */}
        {isMultiFile && (
          <motion.p
            key={`file-${currentFileIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-sm font-mono text-sonar-highlight/70"
          >
            Processing file {currentFileIndex + 1} of {filesToProcess.length}
          </motion.p>
        )}

        {/* Wallet progress indicator */}
        {isFastUploadEnabled && walletProgress.total > 0 && (
          <motion.p
            key={`wallet-${walletProgress.current}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-1 text-sm font-mono text-sonar-signal"
          >
            {stage === 'funding-wallets' && (
              <>Funding wallet {walletProgress.current} of {walletProgress.total}</>
            )}
            {stage === 'sweeping-wallets' && (
              <>Sweeping wallet {walletProgress.current} of {walletProgress.total}</>
            )}
          </motion.p>
        )}
      </div>

      {/* Stage List */}
      <div className="space-y-3">
        {stages.map((stageInfo, index) => {
          const isCompleted = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          const isPending = index > currentStageIndex;

          return (
            <motion.div
              key={stageInfo.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <GlassCard
                className={cn(
                  'transition-all duration-300',
                  isCurrent && 'bg-sonar-signal/10 border border-sonar-signal',
                  isCompleted && 'opacity-70'
                )}
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={cn(
                      'p-3 rounded-sonar transition-colors',
                      isCompleted && 'bg-sonar-signal/20 text-sonar-signal',
                      isCurrent && 'bg-sonar-signal/30 text-sonar-signal animate-pulse',
                      isPending && 'bg-sonar-blue/10 text-sonar-blue/50'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      stageInfo.icon
                    )}
                  </div>

                  <div className="flex-1">
                    <p
                      className={cn(
                        'font-mono font-semibold',
                        isCompleted && 'text-sonar-highlight/70',
                        isCurrent && 'text-sonar-highlight-bright',
                        isPending && 'text-sonar-highlight/50'
                      )}
                    >
                      {stageInfo.label}
                    </p>
                  </div>

                  {isCompleted && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-sonar-signal"
                    >
                      <CheckCircle className="w-6 h-6" />
                    </motion.div>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      {/* Info Box */}
      <GlassCard className={cn(
        isFastUploadEnabled ? 'bg-sonar-signal/5' : 'bg-sonar-blue/5'
      )}>
        <div className="flex items-start space-x-3">
          {isFastUploadEnabled ? (
            <Wallet className="w-5 h-5 text-sonar-signal mt-0.5 flex-shrink-0" />
          ) : (
            <Shield className="w-5 h-5 text-sonar-blue mt-0.5 flex-shrink-0" />
          )}
          <div className="text-sm text-sonar-highlight/80 space-y-2">
            <p className={cn(
              'font-mono font-semibold',
              isFastUploadEnabled ? 'text-sonar-signal' : 'text-sonar-blue'
            )}>
              {isFastUploadEnabled ? 'Fast Upload Mode (Parallel Processing)' : 'Secure Processing'}
            </p>
            <p>
              {isFastUploadEnabled ? (
                <>
                  Using {calculateWalletCount(filesToProcess.map(f => f.file))} ephemeral sub-wallets
                  for parallel processing. Your audio is being encrypted client-side using Mysten Seal,
                  then uploaded to Walrus in parallel batches. All funds will be swept back to your
                  main wallet after completion.
                </>
              ) : (
                <>
                  Your audio is being encrypted client-side using Mysten Seal. The
                  encrypted data is then uploaded to Walrus decentralized storage.
                  Only you control the decryption keys.
                </>
              )}
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
