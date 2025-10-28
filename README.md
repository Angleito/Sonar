# SONAR Protocol

**Sound Oracle Network for Audio Rewards**

> Amplifying Data Value

---

## Overview

SONAR is a decentralized marketplace for high-quality conversational audio data, designed to incentivize creators while ensuring data privacy and quality. Built on the Sui blockchain with Walrus storage and Mysten Seal encryption, SONAR introduces an innovative **absolute-threshold dynamic burn model** that ensures sustainable token economics throughout the protocol's lifecycle.

**Hackathon:** Walrus Haulout 2025
**Track:** Data Economy/Marketplaces

---

## The Problem

Current audio data marketplaces suffer from:
- Poor quality control (no validation)
- Privacy concerns (centralized storage)
- Unsustainable tokenomics (fixed burn rates lead to death spirals)
- Misaligned incentives (platforms capture most value)

---

## The Solution

SONAR addresses these challenges through:

### 1. Quality-First Approach
- LLM-validated conversational quality scoring
- Tiered rewards based on contribution quality (0.001% - 0.005% of supply)
- Submission fees prevent spam (0.001% burn)

### 2. Privacy by Design
- Client-side encryption with Mysten Seal before upload
- Decentralized storage on Walrus
- Only authorized purchasers receive decryption shares
- Zero blob ID exposure in public events

### 3. Adaptive Economics
Unlike traditional fixed-rate burns that eventually kill protocols, SONAR uses **absolute circulating supply thresholds** to automatically adjust economic parameters:

| Phase | Circulating Supply | Burn Rate | Liquidity | Uploader Share |
|-------|-------------------|-----------|-----------|----------------|
| Early | >50M SONAR | 60% | 0% | 30% |
| Growth | 35-50M SONAR | 45% | 10% | 35% |
| Mature | 20-35M SONAR | 30% | 15% | 45% |
| Conservation | <20M SONAR | 20% | 20% | 50% |

As the token becomes scarcer, the system automatically:
- Reduces deflationary pressure
- Increases liquidity provisioning
- Rewards creators more generously
- Maintains long-term sustainability

### 4. Secondary Market Protection
- Automated liquidity vault accumulation
- Circuit breaker for catastrophic events
- Treasury buyback framework
- Dynamic uploader bonuses during downturns

---

## How It Works

### For Creators
1. Record conversational audio
2. Upload via SONAR interface (client-side Seal encryption)
3. Pay small burn fee (0.001% of circulating supply)
4. Receive LLM quality score
5. Earn tokens based on quality (vested over 90 days)
6. List datasets for sale to unlock vesting early

### For Data Buyers
1. Browse marketplace with quality filters
2. Purchase datasets with SONAR tokens
3. Receive authenticated decryption access
4. Download encrypted data from Walrus
5. Decrypt with Seal shares

### For the Ecosystem
- Automatic burns create deflationary pressure (60% → 20%)
- Liquidity vault accumulates for AMM deployment (0% → 20%)
- Treasury receives consistent funding (10%)
- Tier transitions happen automatically based on circulating supply

---

## Key Innovations

### Absolute Threshold Model
Traditional percentage-based burn models cause u64 overflow in Move:
```move
// ❌ OVERFLOW RISK
let ratio = (current_supply * 1_000_000) / initial_supply;
// 10^17 * 10^6 = 10^23 > u64::MAX
```

SONAR uses absolute token counts:
```move
// ✅ NO OVERFLOW - Direct comparison
if (circulating_supply > 50_000_000_000_000_000) {
    // Tier 1: 60% burn
}
```

### Dynamic Circulating Supply
Correctly calculates circulating supply by excluding escrowed tokens:
```move
Circulating = Total Supply - Reward Pool - Liquidity Vault
```

This ensures:
- Accurate tier assignments
- Fair reward calculations
- No distortion from locked tokens

### Privacy-First Architecture
- Audio encrypted client-side with Seal before leaving user's device
- Blob IDs never exposed in public blockchain events
- Decryption shares only provided to verified purchasers
- End-to-end privacy guarantees

---

## Technology Stack

### Blockchain
- **Sui Network:** Fast, low-cost L1 blockchain
- **Move Language:** Type-safe smart contract development
- **Capability-Based Security:** AdminCap, ValidatorCap pattern

### Storage & Privacy
- **Walrus:** Decentralized blob storage network
- **Mysten Seal:** Threshold encryption for access control
- **Client-Side Encryption:** Data never exposed unencrypted

### Validation
- **LLM Quality Scoring:** Automated conversational quality assessment
- **Resilient Pipeline:** Retry logic for validation failures
- **On-Chain Verification:** ValidatorCap signatures

### Frontend (Planned)
- React with Sui Wallet Adapter
- Real-time economic metrics display
- Audio recording and encryption UI
- Marketplace browser with quality filters

---

## Token Economics

### SONAR Token
- **Type:** Sui Fungible Token (Coin<SONAR>)
- **Total Supply:** 100,000,000 SONAR (fixed, non-mintable)
- **Decimals:** 9

### Initial Distribution
- **Reward Pool:** 70,000,000 SONAR (70%)
- **Team Allocation:** 30,000,000 SONAR (30%, vested 24 months)

### Utility
- Submission fees (burned)
- Quality rewards (vested 90 days)
- Dataset purchases (dynamic splits)
- Future governance (post-AdminCap burn)

### Deflationary Mechanics
- Submission burns (0.001% per submission)
- Purchase burns (60% → 20% adaptive)
- Fixed supply (no minting)
- Vesting delays circulation

---

## Project Status

This project is currently in the **design and specification phase** for the Walrus Haulout 2025 Hackathon.

### Completed
- ✅ Complete technical specification
- ✅ Token economics modeling
- ✅ Smart contract architecture design
- ✅ Privacy and security framework

### In Progress
- 🔄 Smart contract implementation
- 🔄 Backend validator service
- 🔄 Frontend application
- 🔄 Walrus and Seal integration

### Planned
- ⏳ Testnet deployment
- ⏳ Security audit
- ⏳ AMM liquidity deployment
- ⏳ Mainnet launch

---

## Repository Structure

```
sonar/
├── README.md                 # This file
├── SPECIFICATION.md          # Complete technical specification
├── contracts/                # Sui Move smart contracts (planned)
├── backend/                  # Validator service (planned)
├── frontend/                 # React application (planned)
├── scripts/                  # Deployment and testing scripts (planned)
└── docs/                     # Additional documentation (planned)
```

---

## Development

### Prerequisites
- Sui CLI (v1.0+)
- Node.js (v18+)
- Rust (for Move development)
- Walrus CLI
- Mysten Seal SDK

### Setup (Planned)
```bash
# Clone repository
git clone https://github.com/sonar-protocol/sonar.git
cd sonar

# Install dependencies
npm install

# Build contracts
cd contracts
sui move build

# Run tests
sui move test

# Deploy to testnet
npm run deploy:testnet
```

---

## Contributing

This project is being developed for the Walrus Haulout 2025 Hackathon. After the hackathon, we welcome contributions!

### Areas of Interest
- Smart contract development (Move)
- Frontend development (React/TypeScript)
- Audio processing and validation
- Cryptography and security
- Token economics modeling

---

## Security

### Current Status
- Design phase - no deployed contracts yet
- Security considerations documented in specification
- Audit planned before mainnet deployment

### Reporting Issues
For security concerns, please email: security@sonar.xyz (placeholder)

---

## License

TBD (To be determined post-hackathon)

---

## Contact & Community

- **Discord:** discord.gg/sonar (placeholder)
- **Twitter:** @sonarprotocol (placeholder)
- **Email:** team@sonar.xyz (placeholder)
- **Documentation:** docs.sonar.xyz (placeholder)

---

## Acknowledgments

Built for **Walrus Haulout 2025 Hackathon**

Special thanks to:
- Mysten Labs for Sui, Walrus, and Seal
- The Sui developer community
- Hackathon organizers and mentors

---

**SONAR Protocol - Amplifying Data Value**

*Decentralized. Private. Quality-First.*
