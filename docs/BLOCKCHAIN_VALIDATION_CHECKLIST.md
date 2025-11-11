# Blockchain Validation Checklist

Use this checklist to confirm the backend-free architecture functions correctly after each deployment (staging and production).

## 1. Pre-flight Configuration

- [ ] Confirm `NEXT_PUBLIC_PACKAGE_ID` and `NEXT_PUBLIC_MARKETPLACE_ID` are present in the hosting environment (Vercel/Netlify).  
      *Source:* `contracts/deployments/<network>.json`.
- [ ] Optional: populate `NEXT_PUBLIC_STATS_OBJECT_ID` (usually the same as the marketplace object).  
- [ ] Optional: populate `NEXT_PUBLIC_REWARD_POOL_ID` if reporting aggregated balances.
- [ ] Run `bun run lint && bun run type-check` to ensure no build-time regressions.
- [ ] Inspect build output for `console.warn('[sui/client] Blockchain config incomplete'...)`. No warnings should appear in production builds.

## 2. Preview Playback

1. Publish (or seed) a dataset with a valid `preview_blob_id`.
2. Open the marketplace grid and hover the dataset card.
   - [ ] Confirm `/api/edge/walrus/preview?blobId=<preview_blob_id>` returns `200` with `Cache-Control: public, max-age=3600`.
   - [ ] Audio preview loads without hitting the legacy backend endpoints.
3. Open the dataset detail page.
   - [ ] `GET` preview request succeeds via the same endpoint.

## 3. Purchase → Unlock Flow

1. Connect a funded wallet (testnet or mainnet as appropriate).
2. Purchase a dataset.
   - [ ] Wallet prompt shows the real package ID (not `0x0000...`).
   - [ ] Transaction executes successfully.
3. Immediately after purchase, click **Unlock Full Audio**.
   - [ ] Ownership verification succeeds without forcing a hard refresh (cache invalidated).
   - [ ] Seal session establishes and decrypts audio in-browser.
4. Download decrypted audio.
   - [ ] `/api/edge/walrus/proxy/<blobId>` streams the encrypted blob with progress updates.

## 4. Missing Config Guard Rails

- [ ] Temporarily unset `NEXT_PUBLIC_PACKAGE_ID` locally, run the app, and attempt to purchase.
  - UI should display “Blockchain configuration incomplete…” and skip the wallet prompt.
  - Purchase verification should return mock `true` only in explicit dev mode; production builds must never fall back silently.

## 5. Regression Smoke Tests

- [ ] `bun test` (focus on hooks and purchasing logic).
- [ ] Manual smoke through waveform playback, preview hover, unlock flow, and download flow.

Document any deviations and link transaction digests or console logs for future debugging.

