/**
 * Tests for useWalrusParallelUpload hook
 * Verifies upload strategy selection, parallel uploads, and error handling
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { useWalrusParallelUpload } from '../useWalrusParallelUpload';

// Mock fetch globally
const mockFetch = mock(() => Promise.resolve({
  ok: true,
  json: async () => ({
    blobId: 'test-blob-id',
    certifiedEpoch: 100,
    fileSize: 1024,
    seal_policy_id: 'test-policy-id',
    strategy: 'blockberry',
  }),
}));

global.fetch = mockFetch as any;

describe('useWalrusParallelUpload', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Strategy Selection', () => {
    it('should select blockberry strategy for files < 1GB', async () => {
      const { result } = renderHook(() => useWalrusParallelUpload());

      const fileSize = 500 * 1024 * 1024; // 500 MB
      const strategy = result.current.getUploadStrategy(fileSize);

      expect(strategy).toBe('blockberry');
    });

    it('should select sponsored-parallel strategy for files >= 1GB', async () => {
      const { result } = renderHook(() => useWalrusParallelUpload());

      const fileSize = 1.5 * 1024 * 1024 * 1024; // 1.5 GB
      const strategy = result.current.getUploadStrategy(fileSize);

      expect(strategy).toBe('sponsored-parallel');
    });
  });

  describe('Single File Upload', () => {
    it('should upload a single file via Blockberry', async () => {
      const { result } = renderHook(() => useWalrusParallelUpload());

      const encryptedBlob = new Blob(['test data'], { type: 'application/octet-stream' });
      const seal_policy_id = 'test-policy-id';
      const backupKey = new Uint8Array([1, 2, 3, 4]);
      const metadata = { threshold: 2, accessPolicy: 'purchase' };

      const uploadResult = await result.current.uploadBlob(
        encryptedBlob,
        seal_policy_id,
        backupKey,
        metadata
      );

      expect(uploadResult).toBeDefined();
      expect(uploadResult.blobId).toBe('test-blob-id');
      expect(uploadResult.seal_policy_id).toBe('test-policy-id');
      expect(uploadResult.strategy).toBe('blockberry');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should include preview blob if provided', async () => {
      const { result } = renderHook(() => useWalrusParallelUpload());

      const encryptedBlob = new Blob(['test data'], { type: 'application/octet-stream' });
      const previewBlob = new Blob(['preview data'], { type: 'audio/mp3' });
      const seal_policy_id = 'test-policy-id';
      const backupKey = new Uint8Array([1, 2, 3, 4]);
      const metadata = { threshold: 2, accessPolicy: 'purchase' };

      // Mock preview upload
      mockFetch.mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: async () => ({
          blobId: 'test-blob-id',
          seal_policy_id: 'test-policy-id',
          strategy: 'blockberry',
        }),
      })).mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: async () => ({
          previewBlobId: 'preview-blob-id',
        }),
      }));

      const uploadResult = await result.current.uploadBlob(
        encryptedBlob,
        seal_policy_id,
        backupKey,
        metadata,
        previewBlob
      );

      expect(uploadResult.previewBlobId).toBe('preview-blob-id');
      expect(mockFetch).toHaveBeenCalledTimes(2); // Main + preview
    });
  });

  describe('Error Handling', () => {
    it('should throw error for sponsored-parallel strategy (not yet implemented)', async () => {
      const { result } = renderHook(() => useWalrusParallelUpload());

      const largeBlob = new Blob(['x'.repeat(1024 * 1024 * 1024 * 2)]); // 2 GB
      const seal_policy_id = 'test-policy-id';
      const backupKey = new Uint8Array([1, 2, 3, 4]);
      const metadata = { threshold: 2, accessPolicy: 'purchase' };

      await expect(
        result.current.uploadBlob(largeBlob, seal_policy_id, backupKey, metadata)
      ).rejects.toThrow('Sponsored parallel uploads not yet implemented');
    });

    it('should handle upload failure gracefully', async () => {
      const { result } = renderHook(() => useWalrusParallelUpload());

      mockFetch.mockImplementationOnce(() => Promise.resolve({
        ok: false,
        statusText: 'Internal Server Error',
      }));

      const encryptedBlob = new Blob(['test data']);
      const seal_policy_id = 'test-policy-id';
      const backupKey = new Uint8Array([1, 2, 3, 4]);
      const metadata = { threshold: 2, accessPolicy: 'purchase' };

      await expect(
        result.current.uploadBlob(encryptedBlob, seal_policy_id, backupKey, metadata)
      ).rejects.toThrow('Blockberry upload failed');
    });
  });

  describe('Progress Tracking', () => {
    it('should track upload progress', async () => {
      const { result } = renderHook(() => useWalrusParallelUpload());

      expect(result.current.progress.stage).toBe('encrypting');
      expect(result.current.progress.totalProgress).toBe(0);

      const encryptedBlob = new Blob(['test data']);
      const seal_policy_id = 'test-policy-id';
      const backupKey = new Uint8Array([1, 2, 3, 4]);
      const metadata = { threshold: 2, accessPolicy: 'purchase' };

      const uploadPromise = result.current.uploadBlob(
        encryptedBlob,
        seal_policy_id,
        backupKey,
        metadata
      );

      await waitFor(() => {
        expect(result.current.progress.stage).toBe('uploading');
      });

      await uploadPromise;
    });
  });

  describe('Orchestrator Integration', () => {
    it('should expose orchestrator for wallet management', () => {
      const { result } = renderHook(() => useWalrusParallelUpload());

      expect(result.current.orchestrator).toBeDefined();
      expect(result.current.orchestrator.calculateWalletCount).toBeDefined();
      expect(result.current.orchestrator.createWallets).toBeDefined();
    });

    it('should calculate optimal wallet count based on file size', () => {
      const { result } = renderHook(() => useWalrusParallelUpload());

      const fileSize1GB = 1 * 1024 * 1024 * 1024;
      const walletCount = result.current.orchestrator.calculateWalletCount(fileSize1GB);

      expect(walletCount).toBeGreaterThan(0);
      expect(walletCount).toBeLessThanOrEqual(100); // Capped at 100
    });
  });
});
