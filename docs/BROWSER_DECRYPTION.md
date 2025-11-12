# Browser-Side Audio Decryption (Mysten Seal)

_Last reviewed: 2025-11-11_

The SONAR marketplace now performs **all** post-purchase access checks and Mysten Seal decryption directly in the browser. No backend access grant is required; the frontend queries the blockchain, fetches encrypted data from Walrus, and decrypts in-memory.

## High-Level Flow
1. **User purchases a dataset** via `usePurchase`, which calls `marketplace::purchase_dataset` on-chain.
2. **Ownership check** (`usePurchaseVerification`) queries recent `DatasetPurchased` events through the Sui RPC to confirm the buyer controls the dataset ID.
3. **Seal session** (`useSeal`) either restores a cached session or requests a new one by asking the wallet to sign a Mysten Seal challenge.
4. **Blob fetch** (`useSealDecryption`) retrieves the encrypted Walrus blob through `/api/edge/walrus/proxy/[blobId]` (which simply streams bytes from the Walrus aggregator).
5. **Threshold decryption** – key shares are requested from the configured Seal key servers (2-of-3 threshold today), combined locally, and used to decrypt the blob.
6. **Playback/download** – decrypted bytes are wrapped in a Blob URL for the audio element, and users can optionally download the decrypted file. URLs are revoked when the component unmounts.

## Key Components

### Hooks & Utilities
- `frontend/hooks/useSeal.ts`: wraps the `@sonar/seal` helpers, handles session caching in IndexedDB, and exposes `encrypt`, `decrypt`, and session management.
- `frontend/hooks/useSealDecryption.ts`: orchestrates the entire decrypt flow, reports `DecryptionProgress`, and exposes `decryptAudio({ blobId, sealPolicyId })`.
- `frontend/hooks/usePurchaseVerification.ts`: caches ownership checks for 5 minutes and falls back to mock mode when `CHAIN_CONFIG.packageId` is unset.
- `frontend/components/dataset/AudioPlayer.tsx`: ties everything together—verifies ownership, creates a Seal session, triggers `decryptAudio`, shows progress, and swaps the audio source to the decrypted Blob URL.

### Edge Functions
- `frontend/app/api/edge/walrus/preview`: proxies preview blobs (public, cached 1 hour).
- `frontend/app/api/edge/walrus/proxy/[blobId]`: streams encrypted content with permissive CORS headers; the browser still enforces Seal policy access.

### Smart-Contract Data
- `AudioSubmission` objects include `walrus_blob_id`, `preview_blob_id`, and `seal_policy_id` so the UI can locate assets without auxiliary databases.
- `DatasetPurchased` events (queried in `usePurchaseVerification`) contain `submission_id`, `buyer`, and the tier economics context used for telemetry.

## Configuration
Set the following environment variables before building the frontend:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PACKAGE_ID` / `NEXT_PUBLIC_MARKETPLACE_ID` | Identify the published SONAR contracts; required for purchase + verification. |
| `NEXT_PUBLIC_WALRUS_AGGREGATOR_URL` | Base URL for Walrus blob downloads (defaults to testnet). |
| `NEXT_PUBLIC_SEAL_KEY_SERVERS` | Comma-separated list of Seal key server object IDs (minimum two for 2-of-3). |
| `NEXT_PUBLIC_SEAL_THRESHOLD` *(optional)* | Overrides the default `Math.min(2, keyServers.length)` behaviour. |
| `NEXT_PUBLIC_USE_BLOCKCHAIN` | Toggle chain reads on/off (falls back to seeded data when `false`). |

## Manual Test Plan
1. **Pre-flight**
   - Wallet connected and funded with SONAR + SUI for gas.
   - `NEXT_PUBLIC_PACKAGE_ID` / `MARKETPLACE_ID` configured; no warnings in console.
   - `NEXT_PUBLIC_SEAL_KEY_SERVERS` set to at least three entries.
2. **Purchase**
   - From `/dataset/[id]` click *Purchase*.
   - Confirm wallet transaction executes, note digest.
3. **Verify unlock**
   - Click *Unlock Full Audio (Browser Decryption)*.
   - Confirm the progress widget runs through: `Verifying purchase → Creating secure session → Fetching encrypted audio → Requesting key shares → Decrypting → Audio decrypted successfully`.
   - Playback switches to `✓ Browser Decryption` state and the waveform resets to full length.
4. **Download**
   - Use the download button (enabled after decryption) and confirm the file plays locally.
5. **Refresh**
   - Reload the page; `usePurchaseVerification` cache should allow immediate unlock without repeating the purchase.
6. **Error scenarios**
   - Disconnect wallet → Unlock button disables with helpful message.
   - Remove Seal key server env var → `useSeal` logs `Seal client disabled` warning.
   - Set wrong `NEXT_PUBLIC_PACKAGE_ID` → Unlock shows configuration error before triggering Seal.

## Error Handling
`useSealDecryption` categorises failures to improve UX:
- **Purchase required**: ownership check returned `false` → instruct user to purchase.
- **Key server unavailable**: Seal share request failed → surface retry guidance.
- **Policy denied**: Seal policy rejected request → user likely used the wrong wallet.
- **Walrus fetch failed**: network error fetching blob → show link to aggregator health.
- **Session missing**: browser cleared IndexedDB or signed-out wallet → re-run `createSession` automatically.

## Future Work
- Encrypt and persist backup key material once per uploader (see TODOs in `components/upload` and `useWalrusParallelUpload`).
- Generate preview snippets client-side instead of relying on pre-encoded assets (`useWalrusUpload` contains TODO markers).
- Persist decrypted blobs in IndexedDB for offline replay while respecting user storage limits.
- Telemetry integration (PostHog/Mixpanel) for decryption success rate and key-server availability tracking.
