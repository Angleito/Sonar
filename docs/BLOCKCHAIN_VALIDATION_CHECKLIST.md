# Blockchain Validation Checklist

Use this after deploying a build or updating env vars. It focuses on the browser-only architecture (no Fastify auth service).

## 1. Pre-flight Configuration
- [ ] `NEXT_PUBLIC_PACKAGE_ID` & `NEXT_PUBLIC_MARKETPLACE_ID` set (no `[sui/client] Blockchain config incomplete` warnings in console).
- [ ] `NEXT_PUBLIC_SEAL_KEY_SERVERS` lists ≥2 entries (2-of-3 threshold works; 3 recommended).
- [ ] Optional overrides in place if needed: `NEXT_PUBLIC_WALRUS_AGGREGATOR_URL`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_GRAPHQL_URL`.
- [ ] `NEXT_PUBLIC_USE_BLOCKCHAIN=true` (unless intentionally using seeded demo data).
- [ ] Frontend build passes `bun run lint` and `bun run type-check`.

## 2. Preview Playback
1. Load `/marketplace`.
   - [ ] Dataset cards render without network errors.
2. Hover a dataset card.
   - [ ] `GET /api/edge/walrus/preview?blobId=...` returns `200` with `Cache-Control: public, max-age=3600`.
   - [ ] Audio preview plays (confirm via browser DevTools Network tab).
3. Dataset detail page shows the same preview response.

## 3. Purchase → Unlock Flow
1. Connect a funded Sui wallet.
2. Purchase a dataset from `/dataset/[id]`.
   - [ ] Wallet prompt shows the correct Move call (`marketplace::purchase_dataset`).
   - [ ] Transaction digest logs in console.
3. Click **Unlock Full Audio (Browser Decryption)**.
   - [ ] Ownership verification passes (no "Purchase required" error).
   - [ ] Progress widget reaches 100 % and state switches to `✓ Browser Decryption`.
4. Play full-length audio and download the decrypted file.
   - [ ] Downloaded file has correct mime type from dataset metadata.
5. Refresh the page.
   - [ ] Unlock succeeds immediately (ownership cache hit).

## 4. Upload & Walrus Checks
- [ ] `GET /api/edge/walrus/upload` (health check) returns `status: healthy`.
- [ ] Upload wizard completes using Blockberry strategy (<1 GB file) and shows resulting blob IDs.
- [ ] Uploaded blob accessible via `curl $NEXT_PUBLIC_WALRUS_AGGREGATOR_URL/v1/<blobId>`.
- [ ] Preview upload limited to ≤10 MB (API returns 400 if exceeded).

## 5. Guard Rails / Failure Modes
- [ ] Remove `NEXT_PUBLIC_PACKAGE_ID` locally → purchase hook surfaces config error before calling wallet.
- [ ] Clear browser storage to drop Seal session → unlock prompts wallet to sign again.
- [ ] Temporarily set invalid Walrus aggregator URL → preview/proxy endpoints return clear errors.
- [ ] Disable one Seal key server (if self-hosted) → decryption still succeeds with remaining quorum.

## 6. Regression Smoke Tests
- [ ] `bun test --filter sonar-marketplace` passes (hooks + utils).
- [ ] `sui move test` inside `contracts/` passes (economics + integration).
- [ ] Manual sanity check of GraphQL fallback: temporarily block primary endpoint; observe toast `Connected via <endpoint>` once secondary kicks in.

Document deviations (wallet address, dataset ID, blob ID, tx digest) for troubleshooting.

