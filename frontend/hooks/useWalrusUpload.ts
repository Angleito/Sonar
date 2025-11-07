import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AudioFile, WalrusUploadResult, EncryptionResult } from '@/lib/types/upload';

/**
 * Convert Uint8Array to base64 string (browser-safe)
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Hook for uploading encrypted audio to Walrus via Edge Function
 * Handles client-side Seal encryption and streaming upload
 */

interface UseWalrusUploadOptions {
  onProgress?: (progress: number) => void;
  onSuccess?: (result: WalrusUploadResult) => void;
  onError?: (error: Error) => void;
}

export function useWalrusUpload(options?: UseWalrusUploadOptions) {
  const [uploadProgress, setUploadProgress] = useState(0);

  /**
   * Upload main audio blob (expects pre-encrypted data)
   */
  const uploadMutation = useMutation({
    mutationFn: async ({
      encryptedBlob,
      seal_policy_id,
      backupKey,
    }: {
      encryptedBlob: Blob;
      seal_policy_id: string;
      backupKey: Uint8Array;
    }): Promise<WalrusUploadResult> => {
      setUploadProgress(0);

      // Create FormData with blob and metadata
      const formData = new FormData();
      formData.append('file', encryptedBlob, 'encrypted-audio.bin');
      formData.append('seal_policy_id', seal_policy_id);
      // Convert Uint8Array backup key to base64 for transmission (browser-safe)
      formData.append('backup_key', uint8ArrayToBase64(backupKey));

      // Upload to Edge Function
      const response = await fetch('/api/edge/walrus/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();

      setUploadProgress(100);

      return {
        blobId: result.blobId,
        seal_policy_id,
        backupKey,
        previewBlobId: undefined, // Will be uploaded separately
      };
    },
    onSuccess: (data) => {
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });

  /**
   * Upload preview blob (optional, for public preview)
   */
  const uploadPreviewMutation = useMutation({
    mutationFn: async (previewBlob: Blob): Promise<string> => {
      const formData = new FormData();
      formData.append('file', previewBlob, 'preview.mp3');

      const response = await fetch('/api/edge/walrus/preview', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Preview upload failed');
      }

      const result = await response.json();
      return result.previewBlobId;
    },
  });

  /**
   * Upload both main and preview blobs
   */
  const uploadWithPreview = async (
    encryptionResult: EncryptionResult,
    previewBlob?: Blob
  ): Promise<WalrusUploadResult> => {
    // Upload main encrypted blob
    const mainResult = await uploadMutation.mutateAsync({
      encryptedBlob: encryptionResult.encryptedBlob,
      seal_policy_id: encryptionResult.seal_policy_id,
      backupKey: encryptionResult.backupKey,
    });

    // Upload preview if provided
    if (previewBlob) {
      try {
        const previewBlobId = await uploadPreviewMutation.mutateAsync(previewBlob);
        mainResult.previewBlobId = previewBlobId;
      } catch (error) {
        console.warn('Preview upload failed, continuing without preview:', error);
      }
    }

    return mainResult;
  };

  return {
    upload: uploadMutation.mutate,
    uploadAsync: uploadMutation.mutateAsync,
    uploadWithPreview,
    uploadPreview: uploadPreviewMutation.mutate,
    uploadPreviewAsync: uploadPreviewMutation.mutateAsync,
    isUploading: uploadMutation.isPending || uploadPreviewMutation.isPending,
    uploadProgress,
    error: uploadMutation.error || uploadPreviewMutation.error,
    reset: () => {
      uploadMutation.reset();
      uploadPreviewMutation.reset();
      setUploadProgress(0);
    },
  };
}

/**
 * Generate preview blob from audio file
 * Extracts first 30 seconds at lower quality
 * Note: This is a placeholder - actual implementation would use Web Audio API
 */
export async function generatePreviewBlob(audioFile: AudioFile): Promise<Blob> {
  // TODO: Implement actual preview generation using Web Audio API
  // For now, just return a small portion of the original file
  const chunkSize = Math.min(audioFile.file.size, 1024 * 1024); // 1MB max
  return audioFile.file.slice(0, chunkSize);
}
