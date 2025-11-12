# End-to-End Testing Checklist

_Last updated: 2025-11-11_

This checklist covers the core user journeys supported by the current repository. It assumes the Next.js app (with edge routes) is running locally and the smart contracts are deployed on Sui testnet.

## Preconditions
- Environment variables configured (`NEXT_PUBLIC_PACKAGE_ID`, `NEXT_PUBLIC_MARKETPLACE_ID`, `NEXT_PUBLIC_SEAL_KEY_SERVERS`, `NEXT_PUBLIC_WALRUS_AGGREGATOR_URL`).
- `bun run dev` running from the repo root (auto-starts the frontend + edge functions).
- Browser wallet (Mysten Wallet, Sui Wallet, Ethos, etc.) connected to Sui testnet with:
  - ≥0.2 SUI for gas.
  - Enough SONAR tokens to purchase a dataset (price shown in UI).
- Optional: Walrus aggregator reachable from the test machine.

## Scenario A — Browse, Purchase, Decrypt
1. **Marketplace load**
   - Navigate to `/marketplace`.
   - Verify dataset cards render actual data (no seed-fallback warning).
   - Hover to confirm preview playback via `/api/edge/walrus/preview`.
2. **Dataset detail**
   - Click a dataset; confirm metadata (title, languages, price) matches on-chain values.
   - Ensure the info banner indicates `Preview Mode` before purchase.
3. **Purchase**
   - Connect wallet and click *Purchase*.
   - Wallet prompt should call `marketplace::purchase_dataset`.
   - After confirmation, toast shows success and console logs digest.
4. **Unlock / Decrypt**
   - Click *Unlock Full Audio (Browser Decryption)*.
   - Progress widget should run through the stages and finish at 100 %.
   - Waveform resets to full duration, audio plays end-to-end, and banner shows `✓ Browser Decryption`.
   - Download button saves a playable file with the expected extension.
5. **Persistence**
   - Refresh the page: unlock should succeed immediately (ownership cache).
   - Disconnect wallet: unlock button disables with guidance.

## Scenario B — Upload (Blockberry Strategy)
1. Open the upload wizard (`/upload` from the navbar).
2. Step through metadata entry, attach a 5+ minute audio file, and proceed to encryption.
3. Upload should route through `/api/edge/walrus/upload` and finish with blob IDs displayed.
4. Confirm `walrus-uploads.txt` updated and aggregator responds 200 for the blob ID.
5. (Optional) Submit dataset transaction on-chain using the newly acquired blob IDs and seal policy.

## Scenario C — Failure Handling
- **Missing config**: remove `NEXT_PUBLIC_PACKAGE_ID` and reload → purchase button should display a configuration error instead of triggering wallet.
- **Invalid blob ID**: temporarily change aggregator URL to an invalid host → unlock flow should present "Failed to fetch encrypted audio" without crashing.
- **Key server outage**: comment out one key server entry (if self-hosted) and verify decryption still succeeds. Remove all entries → unlock shows "Seal client disabled" notice.

## Regression Commands
```bash
bun test --filter sonar-marketplace      # frontend hooks/components
(cd contracts && sui move test)          # Move unit tests
```
Run these after modifying hooks, smart contracts, or shared packages.

## Notes
- Record wallet address, dataset ID, blob IDs, and transaction digests for each test run; they are useful when filing issues.
- Use the `docs/BLOCKCHAIN_VALIDATION_CHECKLIST.md` for additional smoke checks around env guards and GraphQL fallback.
