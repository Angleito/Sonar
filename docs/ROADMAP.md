# SONAR Protocol Roadmap

_Last updated: 2025-11-11_

This roadmap reflects the implementation state of the repository. Keep it in sync with TODO markers in the code (`useWalrusParallelUpload`, `components/upload`, `packages/seal`).

## Live (Alpha) — ✅ Shipping Today
- Wallet-only architecture (no centralized auth or JWT). Purchases and ownership checks happen entirely on-chain (`usePurchase`, `usePurchaseVerification`).
- Walrus integration through edge functions (`/api/edge/walrus/upload`, `preview`, `proxy`). Preview playback is proxied with CDN-friendly caching.
- Browser-side Mysten Seal decryption with progress UI and download support (`useSeal`, `useSealDecryption`, `AudioPlayer`).
- Seeded data fallbacks for demos plus GraphQL multi-endpoint resilience when `NEXT_PUBLIC_USE_BLOCKCHAIN=true`.
- Submission + dataset flows emitting Walrus + Seal metadata on-chain (`marketplace.move`).

## In Flight (Next 1–2 Milestones)
- **Sponsored Walrus uploads**: client orchestration lives in `useSubWalletOrchestrator`; awaits SDK support for dual-signature gas flows.
- **Preview generation**: TODOs in `useWalrusUpload` and `components/upload` to derive 30s previews client-side instead of requiring pre-cut files.
- **Encrypted backup keys**: TODOs in upload steps to encrypt Seal backup keys with the uploader's public key before persistence.
- **Telemetry hooks**: capture decrypt success/error states once analytics tooling is wired in (currently console-only).
- **Marketplace polish**: share explorer links + digest in purchase toasts, flesh out empty states, and surface on-chain pricing tiers in the UI.

## Backlog Themes (Longer Term)
- Multi-file dataset playback UI (dataset bundles already supported by the contract, UI still single-file oriented).
- Governance + treasury management flows once the DAO story solidifies.
- Expanded dataset types (images/text) once Walrus upload + Seal encryption patterns are production hardened.
- Creator analytics dashboards powered by on-chain event indexing.

## References
- UI roadmap page lives at `frontend/app/roadmap/page.tsx`; update it alongside this doc when messaging changes.
- Track code-level tasks via inline TODOs and issues in GitHub (none auto-generated yet).
