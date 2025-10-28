# SONAR Protocol - Build Environment Versions

## Summary

This document tracks the exact versions of tools and dependencies used to build and deploy the SONAR Protocol smart contracts.

## Build Environment

| Component | Version | Notes |
|-----------|---------|-------|
| **Sui CLI** | 1.57.2-homebrew | System version (newer than WAL) |
| **Move Edition** | 2024.beta | Matches Walrus contracts |
| **Move Compiler** | 1.57.2 | Bundled with Sui CLI |
| **Rust** | TBD | To be captured during build |
| **Node.js** | 18.17.0+ | For deployment scripts |
| **Bun** | Latest | For web development (frontend) |

## Walrus Integration

| Component | Version/ID | Source |
|-----------|------------|--------|
| **WAL Contracts Sui Version** | testnet-v1.43.0 | From Move.lock |
| **WAL Move Compiler** | 1.43.1 | From Move.lock |
| **WAL Move Edition** | 2024.beta | From Move.toml |
| **WAL Published Package ID** | `0x261b2e46428a152570f9ac08972d67f7c12d62469ccd381a51774c1df7a829ca` | Testnet |
| **WAL Repository** | https://github.com/MystenLabs/walrus-docs | Cloned 2025-10-28 |

## Version Compatibility Notes

### Sui CLI Version Difference

**Walrus uses**: Sui testnet-v1.43.0 (compiler 1.43.1)
**SONAR uses**: Sui 1.57.2-homebrew (compiler 1.57.2)

**Rationale for newer version**:
1. Both use Move 2024.beta edition (compatible)
2. Move language is backward compatible within the same edition
3. Newer Sui versions include bug fixes and optimizations
4. SONAR only references WAL types/IDs, doesn't modify WAL contracts
5. Successful compilation test: Both Move.toml dependencies resolve correctly

**Risk mitigation**:
- Tested compilation with `sui move build` before implementation
- Vendored exact WAL contract dependencies locally
- Will verify on testnet before mainnet deployment
- Can downgrade to 1.43.1 if compatibility issues arise

### Move Edition Alignment

Both SONAR and Walrus use **Move 2024.beta edition**, ensuring:
- Compatible syntax and semantics
- Shared type system
- Consistent package resolution
- No edition-related conflicts

## Network Configuration

| Network | Chain ID | Status |
|---------|----------|--------|
| **Sui Testnet** | 4c78adac | Active |
| **Walrus Testnet** | TBD | Active |

## Deployment Timestamps

- **Walrus Package Published**: Version 3 (from Move.lock)
- **SONAR Development Start**: 2025-10-28
- **SONAR Testnet Deployment**: TBD
- **SONAR Mainnet Deployment**: TBD

## Tool Installation Commands

### Sui CLI (Current Version)
```bash
# Already installed via Homebrew
sui --version
# Output: sui 1.57.2-homebrew
```

### Sui CLI (Match WAL Version - if needed)
```bash
# If compatibility issues arise, install exact WAL version:
cargo install --locked --git https://github.com/MystenLabs/sui.git \
  --tag testnet-v1.43.0 sui

# Verify
sui --version
# Expected: sui 1.43.0
```

### Rust Toolchain
```bash
# Install/update Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update stable
rustc --version  # Capture for this doc
```

### Node.js & Bun
```bash
# Node.js (via nvm recommended)
nvm install 18
nvm use 18
node --version

# Bun
curl -fsSL https://bun.sh/install | bash
bun --version
```

## Verification Commands

### Verify Sui Installation
```bash
sui --version
sui client --version
sui move --help
```

### Verify Move Compilation
```bash
cd contracts
sui move build
# Should succeed without errors
```

### Verify WAL Dependency Resolution
```bash
cd contracts
sui move build --skip-fetch-latest-git-deps
# Should resolve WAL types correctly
```

## Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2025-10-28 | Initial version doc created | Project setup |
| 2025-10-28 | Sui 1.57.2 vs WAL 1.43.0 documented | Version compatibility check |

## Future Considerations

### Mainnet Deployment
When deploying to mainnet:
1. Verify WAL mainnet package IDs
2. Update Move.toml with mainnet Sui rev
3. Consider matching exact Sui version if testnet issues arise
4. Re-run full test suite on mainnet
5. Update this document with mainnet versions

### Sui Framework Updates
Monitor Sui releases for:
- Breaking changes in Move 2024 edition
- Security patches requiring updates
- New features that could optimize SONAR
- WAL package updates/migrations

### WAL Dependency Updates
If Walrus updates their contracts:
1. Clone new version to /tmp
2. Check Move.lock for version changes
3. Test compilation compatibility
4. Update vendored dependencies if needed
5. Retest SONAR integration
6. Update this document

## Contact & Support

For version-related questions:
- **Technical**: tech@sonar.xyz
- **DevOps**: ops@sonar.xyz
- **Sui Discord**: #move-lang channel
- **Walrus Discord**: #developers channel
