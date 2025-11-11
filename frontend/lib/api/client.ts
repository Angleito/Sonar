/**
 * Edge API Client
 * Provides URLs for edge functions (Walrus upload, preview proxy)
 */

/**
 * Get preview audio URL (edge proxy to Walrus)
 *
 * @param blobId - Walrus blob ID (typically preview_blob_id)
 */
export function getPreviewUrl(blobId: string): string {
  return `/api/edge/walrus/preview?blobId=${encodeURIComponent(blobId)}`;
}

/**
 * Legacy stream URL (deprecated - use browser decryption instead)
 * @deprecated Use browser-side decryption with Seal instead
 */
export function getStreamUrl(datasetId: string, _token: string): string {
  console.warn('[API Client] getStreamUrl is deprecated. Use browser-side decryption instead.');
  return `/api/edge/walrus/preview?blobId=${datasetId}`;
}
