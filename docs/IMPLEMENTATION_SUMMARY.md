# SONAR Implementation Summary

_Last reviewed: 2025-11-11_

## Snapshot
- **Single Next.js 16 frontend** (`frontend/`) serves the entire product, including upload tooling and marketplace UI.
- **Edge functions** under `frontend/app/api/edge/walrus/*` proxy Walrus uploads/previews so no dedicated backend is required for the current release.
- **On-chain contracts** in `contracts/sources` implement the SONAR marketplace, economics, storage leases, and purchase policy in Move 2024.beta.
- **Mysten Seal tooling** lives in `packages/seal`; the frontend consumes it via the `useSeal` / `useSealDecryption` hooks for browser-side decryption.
- A Fastify service still exists in `backend/`, but it is optional and no longer part of the default data path.

## Architecture Overview

### Frontend (`frontend/`)
- **Framework**: Next.js `^16.0.1`, React 19, TypeScript, TailwindCSS and framer-motion for UI polish.
- **Data layer**: `RepositoryProvider` switches between the blockchain-backed `SuiRepository` and the local `SeedDataRepository`, letting tests run without chain access.
- **GraphQL failover**: `frontend/lib/sui/client.ts` builds both RPC and multi-endpoint GraphQL clients. `USE_BLOCKCHAIN` gates whether we hit the live chain.
- **Query hooks**: `useDatasets`, `useDataset`, `useFeaturedDatasets` (in `frontend/hooks`) hide the fetch logic and cache results with `@tanstack/react-query`.
- **Purchase & ownership**: `usePurchase` constructs a Move transaction that calls `marketplace::purchase_dataset`, while `usePurchaseVerification` replays `DatasetPurchased` events via RPC to confirm ownership and clear caches.
- **Playback**: `useWaveform` + `components/dataset/AudioPlayer.tsx` render real peaks, manage preview vs. decrypted playback, and integrate the Seal session lifecycle.
- **Upload**: `useWalrusParallelUpload` and `useWalrusUpload` orchestrate encryption, Walrus HTTP uploads, and preview blob creation, with hooks for the planned sponsored-transaction path.

### Edge API (`frontend/app/api/edge/walrus`)
- `upload/route.ts`: PUT streams encrypted blobs to the Walrus publisher, supports Blockberry API keys, and reports blob IDs/epochs.
- `preview/route.ts`: POST uploads 30s previews, GET proxies public preview playback with cache headers.
- `proxy/[blobId]/route.ts`: GET streams encrypted blobs to the browser for local decryption (range requests supported by Walrus).

### Smart Contracts (`contracts/sources`)
- `marketplace.move`: mints 100 M SONAR once, funds a 70 M reward pool, and exposes submission, vesting, purchase, and liquidity vault management. Purchase events emit burn/liquidity/uploader/treasury amounts alongside `seal_policy_id`.
- `economics.move`: defines absolute-tier economics (50 M / 35 M / 20 M thresholds) with burn/liquidity/treasury splits and 0.001 % submission burn fees.
- `storage_lease.move` & `purchase_policy.move`: tie Walrus blobs and Seal policies to dataset objects and receipts.
- `verification_session.move`: lets verified sessions finalize directly into marketplace submissions.

### Shared Packages
- `packages/seal`: thin wrapper over `@mysten/seal` that exposes session helpers used by the frontend hooks.
- `packages/shared`: shared TypeScript types for responses, errors, and Move bindings (still used by the optional backend and tests).

### Optional Backend (`backend/`)
- Bun + Fastify service kept for future API needs (challenge/verify endpoints, JWT auth). The current UI does **not** depend on it; all live flows run through the frontend and chain.

## Core Product Flows
1. **Browse datasets** – `SuiRepository` issues GraphQL queries (with circuit breaker + retry) to load `AudioSubmission` objects. The UI falls back to seeded JSON when blockchain config is absent.
2. **Wallet connection & guards** – `CHAIN_CONFIG` validates `NEXT_PUBLIC_PACKAGE_ID` / `NEXT_PUBLIC_MARKETPLACE_ID`; purchase hooks refuse to run until both are set.
3. **Purchase** – `usePurchase` assembles the transaction, collects SONAR coins, and clears ownership caches on success. The UI surfaces explorer links via the returned digest.
4. **Ownership verification** – `usePurchaseVerification` queries `DatasetPurchased` events directly (no backend) with a five-minute in-memory cache.
5. **Browser decryption** – `useSealDecryption` fetches encrypted blobs from Walrus, requests key shares from the configured Seal key servers, and creates Blob URLs for playback/download. Progress is surfaced through `DecryptionProgress` updates.
6. **Upload** – The upload wizard encrypts audio with Mysten Seal, uploads via `/api/edge/walrus/upload`, generates previews (currently stubbed), and stores Walrus IDs alongside Seal metadata for subsequent on-chain submissions.

## Environment & Configuration
- **Blockchain IDs**: `NEXT_PUBLIC_PACKAGE_ID`, `NEXT_PUBLIC_MARKETPLACE_ID`, optional `NEXT_PUBLIC_STATS_OBJECT_ID` / `NEXT_PUBLIC_REWARD_POOL_ID`. Defaults live in `contracts/deployments/*.json`.
- **Networking**: `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_GRAPHQL_URL` (optional overrides).
- **Walrus & Seal**: `NEXT_PUBLIC_WALRUS_PUBLISHER_URL`, `NEXT_PUBLIC_WALRUS_AGGREGATOR_URL`, `NEXT_PUBLIC_SEAL_KEY_SERVERS` (comma-separated object IDs, required for decryption).
- **Feature flags**: `NEXT_PUBLIC_USE_BLOCKCHAIN`, `NEXT_PUBLIC_SPONSORED_PROTOTYPE_MIN_SIZE` (enables the experimental multi-wallet upload path).
- **Edge secrets**: `BLOCKBERRY_API_KEY` (optional) injected at build/deploy time for Walrus publisher throttling.

## Local Development
```bash
bun install                     # install all workspace deps
bun run dev                     # launch frontend with edge routes
bun run dev --filter backend    # (optional) start Fastify API

# Run Move unit tests
task() { cd contracts && sui move test; }

# Build shared packages
bun run build:packages
```
- Seed data lives in `frontend/data/seed.json`; toggle blockchain usage with `NEXT_PUBLIC_USE_BLOCKCHAIN=false` for offline demos.
- Key dev helper scripts sit under `scripts/` (e.g., `download-audio-samples.ts`).

## Testing & Quality
- **Frontend unit tests**: `bun test --filter sonar-marketplace` (uses happy-dom); focus on hooks (`frontend/hooks/__tests__`).
- **Contract tests**: `contracts/tests/*.move` cover economics, submission, and integration paths.
- **Audio verifier**: `audio-verifier/` provides a CLI pipeline for offline quality checks; see its README for usage.
- **E2E checklist**: `docs/E2E_TESTING.md` captures the manual regression path for wallet purchase + decryption.

## Related Documentation
- `docs/tokenomics.md` – exact economic constants mirrored from Move code.
- `docs/BROWSER_DECRYPTION.md` – Mysten Seal integration details and test plan.
- `docs/WALRUS_UPLOAD_GUIDE.md` – instructions for preparing Walrus blobs.
- `docs/BLOCKCHAIN_VALIDATION_CHECKLIST.md` – quick post-deploy smoke tests.
- `docs/VERSIONS.md` – pinned toolchain/runtime versions.
