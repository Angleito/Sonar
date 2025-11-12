# SONAR Protocol — Pinned Versions

_Last reviewed: 2025-11-11_

## Build & Tooling
| Component | Version | Notes |
|-----------|---------|-------|
| **Move toolchain** | 1.60.0 (sui flavor) | From `contracts/Move.lock` (`compiler-version`). |
| **Move edition** | 2024.beta | Shared by SONAR + Walrus dependencies. |
| **Sui CLI** | 1.60.0+ (matches toolchain) | Install via Homebrew or `cargo install --git https://github.com/MystenLabs/sui.git --tag mainnet-v1.60.0`. |
| **Bun** | 1.2.x | Set by root `packageManager`. |
| **Node.js** | ≥18.17.0 | Needed for Next.js build scripts (use nvm / volta to pin). |

## Frontend Stack (`frontend/package.json`)
| Dependency | Version |
|------------|---------|
| `next` | ^16.0.1 |
| `react` / `react-dom` | ^19.2.0 |
| `@mysten/dapp-kit` | ^0.19.8 |
| `@mysten/sui` | ^1.44.0 (override enforced to exactly 1.44.0) |
| `@tanstack/react-query` | ^5.90.5 |
| `wavesurfer.js` | ^7.11.1 |
| `tailwindcss` | ^3.4.0 |
| `typescript` | ^5.9.3 |

## Move Dependencies (`contracts/dependencies`)
| Package | Source | Commit / Version |
|---------|--------|------------------|
| `Walrus` | vendored | `Move.lock` version `3` (see `dependencies/walrus`) |
| `WAL` | vendored | same as above |
| `MoveStdlib`, `Sui`, `SuiSystem`, `Bridge` | Git | `rev = 494fa6ede17f366f1cd850f01ccb9f42dc75c470` |

## Verification Commands
```bash
# Check toolchain
cd contracts
sui move --version
sui move build

# Confirm frontend versions
cd ../frontend
bun pm ls next react @mysten/sui
```

## Upgrade Notes
- Align Sui CLI with the Move compiler version to avoid bytecode mismatch warnings.
- When updating `@mysten/sui` or `@mysten/dapp-kit`, ensure transactions (`usePurchase`) and GraphQL clients still compile—API changes are frequent between minor versions.
- Walrus dependencies are vendored; re-run `sui move build --skip-fetch-latest-git-deps` after pulling upstream updates.
- Updating Next.js or React may require regenerating the Tailwind config and rerunning `bun test --filter sonar-marketplace`.
