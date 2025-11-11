# @sonar/seal

High-level TypeScript SDK for [Mysten Seal](https://github.com/MystenLabs/seal) encryption with SONAR Protocol optimizations.

## Features

- **Identity-Based Encryption (IBE)** with threshold decryption (2-of-3 key servers)
- **Envelope Encryption** - Automatic AES-256-GCM for large files (>1MB)
- **Session Management** - IndexedDB caching with automatic expiration
- **Batch Decryption** - Pre-fetch keys for efficient multi-file decryption
- **Progress Tracking** - Real-time callbacks for long operations
- **Type-Safe** - Full TypeScript support with comprehensive types
- **Framework-Agnostic** - Works in any browser or Node.js environment
- **Access Policies** - Flexible on-chain policies (purchase, allowlist, subscription, timelock)

## Installation

```bash
bun add @sonar/seal
```

## Quick Start

```typescript
import {
  createSonarSealClient,
  createSession,
  encryptFile,
  decryptFile,
} from '@sonar/seal';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';

// 1. Initialize Sui client
const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

// 2. Create Seal client
const sealClient = createSonarSealClient({
  suiClient,
  network: 'testnet',
});

// 3. Create session with wallet signature
const session = await createSession(walletAddress, packageId, {
  suiClient,
  mvrName: 'SONAR',
  signMessage: async (message) => {
    return await wallet.signPersonalMessage({ message });
  },
});

// 4. Encrypt file
const file = new File([...], 'audio.mp3');
const encrypted = await encryptFile(
  sealClient,
  file,
  {
    packageId: '0xYOUR_PACKAGE_ID',
    accessPolicy: 'purchase',
  },
  (progress, status) => {
    console.log(`${status}: ${progress}%`);
  }
);

console.log('Encrypted identity:', encrypted.identity);

// 5. Decrypt file
const decrypted = await decryptFile(
  sealClient,
  encrypted.encryptedData,
  {
    sessionKey: session,
    packageId: '0xYOUR_PACKAGE_ID',
    identity: encrypted.identity,
    policyModule: 'purchase_policy',
    suiClient,
  }
);

console.log('Decrypted data:', decrypted.data);
```

## Configuration

### Environment Variables

Set key server object IDs for your network:

```env
# Testnet
SEAL_SERVER_1_TESTNET=0x...
SEAL_SERVER_2_TESTNET=0x...
SEAL_SERVER_3_TESTNET=0x...

# Mainnet
SEAL_SERVER_1_MAINNET=0x...
SEAL_SERVER_2_MAINNET=0x...
SEAL_SERVER_3_MAINNET=0x...
```

### Custom Configuration

```typescript
import { createSonarSealClient } from '@sonar/seal';

const client = createSonarSealClient({
  suiClient,
  network: 'testnet',
  keyServers: [
    { objectId: '0x...', weight: 1 },
    { objectId: '0x...', weight: 1 },
    { objectId: '0x...', weight: 1 },
  ],
  threshold: 2, // 2-of-3 threshold
  timeout: 10000, // 10s timeout
  verifyServers: true, // Verify key servers on-chain
});
```

### Singleton Pattern

For app-wide usage, initialize once:

```typescript
import { initializeSealClient, getSealClient } from '@sonar/seal';

// Initialize in app setup
initializeSealClient({
  suiClient,
  network: 'testnet',
});

// Use anywhere
const client = getSealClient();
```

## Usage Examples

### Encryption

#### Small File (Direct Seal)

```typescript
const result = await encryptFile(client, smallFile, {
  packageId: '0x...',
  accessPolicy: 'purchase',
  threshold: 2,
});
```

#### Large File (Envelope Encryption)

Automatically uses AES-256-GCM for files >1MB:

```typescript
const result = await encryptFile(client, largeFile, {
  packageId: '0x...',
  accessPolicy: 'purchase',
  useEnvelope: true, // Force envelope encryption
});

// Result includes same fields
console.log(result.metadata.isEnvelope); // true
```

#### Metadata Encryption

```typescript
const metadata = { title: 'Song', artist: 'Artist' };
const result = await encryptMetadata(client, metadata, {
  packageId: '0x...',
  accessPolicy: 'allowlist',
});
```

#### Custom Identity

```typescript
const customId = new Uint8Array(32); // Your identity
crypto.getRandomValues(customId);

const result = await encryptFile(client, file, {
  packageId: '0x...',
  accessPolicy: 'purchase',
  customId, // Use specific identity
});
```

### Decryption

#### Single File

```typescript
const result = await decryptFile(
  client,
  encryptedData,
  {
    sessionKey,
    packageId: '0x...',
    identity: '0xABCD...', // Hex string
    policyModule: 'purchase_policy',
    suiClient,
  },
  (progress, status) => {
    console.log(`${status}: ${progress}%`);
  }
);
```

#### With Policy Arguments

For policies requiring additional data (e.g., NFT ownership):

```typescript
const result = await decryptFile(client, encryptedData, {
  sessionKey,
  packageId: '0x...',
  identity: '0x...',
  policyModule: 'subscription_policy',
  policyArgs: ['0xNFT_OBJECT_ID'], // Pass NFT as proof
  suiClient,
});
```

#### Batch Decryption

More efficient for multiple files:

```typescript
const items: BatchDecryptItem[] = [
  { identity: '0xAAA', encryptedData: data1 },
  { identity: '0xBBB', encryptedData: data2 },
  { identity: '0xCCC', encryptedData: data3 },
];

const results = await batchDecrypt(
  client,
  items,
  {
    sessionKey,
    packageId: '0x...',
    policyModule: 'purchase_policy',
    suiClient,
    batchSize: 10, // Process 10 at a time
  },
  (progress, status) => {
    console.log(`${status}: ${progress}%`);
  }
);

// Results is a Map<identity, DecryptionResult>
for (const [identity, result] of results) {
  console.log(`Decrypted ${identity}:`, result.data);
}
```

#### Metadata Decryption

```typescript
const metadata = await decryptMetadata<{ title: string; artist: string }>(
  client,
  encryptedMetadata,
  {
    sessionKey,
    packageId: '0x...',
    identity: '0x...',
    policyModule: 'purchase_policy',
    suiClient,
  }
);

console.log(metadata.title, metadata.artist);
```

#### With Retry Logic

For unreliable networks:

```typescript
const result = await decryptFileWithRetry(
  client,
  encryptedData,
  options,
  3 // Max 3 retries
);
```

### Session Management

#### Create Session

```typescript
const session = await createSession(address, packageId, {
  ttlMin: 10, // 10 minutes
  suiClient,
  mvrName: 'SONAR',
  signMessage: wallet.signPersonalMessage,
});
```

#### Restore from Cache

```typescript
const cached = await restoreSession(packageId, suiClient);

if (cached && isSessionValid(cached)) {
  console.log('Using cached session');
} else {
  console.log('Session expired, create new');
}
```

#### Get or Create

```typescript
// Tries cache first, creates if needed
const session = await getOrCreateSession(address, packageId, {
  suiClient,
  signMessage: wallet.signPersonalMessage,
});
```

#### Refresh Before Expiry

```typescript
// Refresh if <2 minutes remaining
const session = await refreshSession(
  currentSession,
  address,
  packageId,
  { suiClient, signMessage: wallet.signPersonalMessage },
  2 // Threshold in minutes
);
```

#### Clear Sessions

```typescript
// Clear specific
await clearSession(packageId);

// Clear all
await clearAllSessions();
```

### Cache Management

#### Default (IndexedDB)

```typescript
import { getCache } from '@sonar/seal';

const cache = getCache(); // Returns IndexedDBCache
```

#### Custom Cache

```typescript
import { setCache, MemoryCache, NoCache } from '@sonar/seal';

// Use memory cache (non-persistent)
setCache(new MemoryCache());

// Disable caching
setCache(new NoCache());
```

#### Manual Cache Operations

```typescript
const cache = getCache();

// Store
await cache.set('key', { data: '...' });

// Retrieve
const value = await cache.get('key');

// Check existence
const exists = await cache.has('key');

// Delete
await cache.delete('key');

// Clear all
await cache.clear();

// Cleanup expired
await cache.cleanup();
```

## Architecture

### Identity-Based Encryption (IBE)

- Each encrypted file has a unique identity (32-byte hex string)
- Threshold decryption: 2-of-3 key servers required
- BLS12-381 curve for IBE
- No need to manage recipient public keys

### Envelope Encryption

For files >1MB, the SDK automatically uses envelope encryption:

```
┌─────────────────────────────────────────────────────┐
│  Envelope Format                                    │
├─────────────────────────────────────────────────────┤
│  [4 bytes]      Key length (little-endian)         │
│  [~300 bytes]   Sealed AES key (Seal-encrypted)    │
│  [12 bytes]     AES IV                             │
│  [variable]     Encrypted file (AES-256-GCM)       │
└─────────────────────────────────────────────────────┘
```

**Why envelope encryption?**
- AES-256-GCM is ~100x faster than IBE for bulk data
- Seal only encrypts the small AES key (~32 bytes)
- Better for files >1MB

### Session Keys

- Session keys are cached in IndexedDB (24h TTL)
- Signed by user's wallet (personal message)
- Used for decryption without re-signing every time
- Automatically expires for security

### Access Policies

On-chain Move modules control who can decrypt:

1. **Purchase Policy** - User must own the dataset (default)
2. **Allowlist Policy** - Only specific addresses
3. **Subscription Policy** - NFT holders only
4. **Timelock Policy** - Time-based access

## API Reference

### Client

- `createSonarSealClient(config)` - Create SealClient with SONAR defaults
- `initializeSealClient(config)` - Initialize singleton
- `getSealClient()` - Get singleton instance
- `isSealClientInitialized()` - Check if initialized
- `resetSealClient()` - Reset singleton

### Encryption

- `encryptFile(client, data, options, onProgress?)` - Encrypt file/data
- `encryptMetadata(client, metadata, options)` - Encrypt JSON metadata
- `estimateEncryptedFileSize(size, useEnvelope?)` - Estimate encrypted size
- `recommendEnvelopeEncryption(size)` - Check if envelope needed

### Decryption

- `decryptFile(client, data, options, onProgress?)` - Decrypt file/data
- `batchDecrypt(client, items, options, onProgress?)` - Batch decrypt
- `decryptMetadata<T>(client, data, options)` - Decrypt typed metadata
- `decryptFileWithRetry(client, data, options, maxRetries?)` - With retry

### Session

- `createSession(address, packageId, options)` - Create new session
- `restoreSession(packageId, suiClient)` - Restore from cache
- `getOrCreateSession(address, packageId, options)` - Get or create
- `refreshSession(session, address, packageId, options, threshold?)` - Refresh
- `cacheSession(packageId, session, address)` - Manually cache
- `clearSession(packageId)` - Clear specific
- `clearAllSessions()` - Clear all
- `isSessionValid(session)` - Check validity
- `isSessionExpired(session)` - Check expiration
- `getSessionInfo(session)` - Get session info
- `ensureSessionValid(session)` - Throw if expired

### Cache

- `getCache()` - Get global cache instance
- `setCache(cache)` - Set global cache
- `createCache(strategy?)` - Create cache with strategy

## Best Practices

### Security

1. **Never store backup keys in plaintext** - Use secure storage (e.g., encrypted localStorage)
2. **Use short session TTLs** - 10-15 minutes for sensitive data
3. **Implement proper access policies** - Don't rely on client-side checks alone
4. **Validate inputs** - Always validate file sizes and types before encryption
5. **Use HTTPS** - Always serve over HTTPS to prevent MITM attacks

### Performance

1. **Use batch decryption** - When decrypting multiple files, use `batchDecrypt()`
2. **Cache sessions** - Let IndexedDB cache sessions for better UX
3. **Stream large files** - Consider chunked encryption for very large files (>100MB)
4. **Monitor progress** - Use progress callbacks for user feedback
5. **Prefetch keys** - For known identities, prefetch keys during idle time

### Error Handling

```typescript
import {
  decryptFile,
  SessionExpiredError,
  PolicyDeniedError,
  DecryptionError,
} from '@sonar/seal';

try {
  const result = await decryptFile(client, data, options);
} catch (error) {
  if (error instanceof SessionExpiredError) {
    // Session expired, prompt user to sign again
    console.error('Session expired, please reconnect wallet');
  } else if (error instanceof PolicyDeniedError) {
    // Access denied by policy
    console.error('You do not have access to this file');
  } else if (error instanceof DecryptionError) {
    // General decryption error
    console.error('Failed to decrypt:', error.message);
  } else {
    // Unknown error
    console.error('Unexpected error:', error);
  }
}
```

### Testing

```typescript
import { resetSealClient, setCache, NoCache } from '@sonar/seal';

beforeEach(() => {
  // Reset singleton for isolated tests
  resetSealClient();

  // Disable caching in tests
  setCache(new NoCache());
});
```

## Troubleshooting

### "IndexedDB not available"

**Cause**: Running in non-browser environment or private browsing
**Solution**: Use MemoryCache instead

```typescript
import { setCache, MemoryCache } from '@sonar/seal';
setCache(new MemoryCache());
```

### "Session expired"

**Cause**: Session TTL elapsed or system time changed
**Solution**: Create new session with wallet signature

```typescript
const newSession = await createSession(address, packageId, options);
```

### "Policy denied"

**Cause**: User doesn't meet access policy requirements
**Solution**: Check policy requirements (e.g., purchase dataset, own NFT)

### "No key servers configured"

**Cause**: Missing environment variables or config
**Solution**: Set SEAL_SERVER_*_TESTNET or provide keyServers in config

### "Invalid threshold"

**Cause**: Threshold > number of key servers
**Solution**: Ensure threshold ≤ number of key servers (recommend 2-of-3)

### "AES decryption failed"

**Cause**: Corrupted data or wrong identity
**Solution**: Verify identity matches encryption, check data integrity

## License

MIT

## Links

- [Mysten Seal](https://github.com/MystenLabs/seal)
- [SONAR Protocol](https://github.com/yourusername/sonar)
- [Sui Documentation](https://docs.sui.io)
