# SONAR Backend API

## Authentication

### POST /auth/challenge

Request a signing challenge for wallet authentication.

**Request:**
```json
{
  "address": "0x..."
}
```

**Response:**
```json
{
  "nonce": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Sign this message to authenticate with SONAR:\n\nAddress: 0x...\nNonce: ...\nExpires: 2024-01-01T12:05:00.000Z\n\nThis signature will be used to verify your wallet ownership.",
  "expiresAt": 1704110700000
}
```

**Status Codes:**
- `200` - Challenge generated
- `400` - Invalid address format
- `500` - Server error

---

### POST /auth/verify

Verify a signed message and get JWT token.

**Request:**
```json
{
  "address": "0x...",
  "signature": "base64...",
  "nonce": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Sign this message to authenticate with SONAR:\n\nAddress: 0x...\nNonce: ...\nExpires: 2024-01-01T12:05:00.000Z\n\nThis signature will be used to verify your wallet ownership."
}
```

**Important:** The `message` field must exactly match the message returned from `/auth/challenge`.

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": 1704197100000
}
```

**Status Codes:**
- `200` - Authentication successful
- `400` - Invalid request format
- `401` - Invalid signature or expired nonce
- `500` - Server error

---

## Data Access

### POST /api/datasets/:id/access

Get access grant for a dataset (requires JWT).

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "seal_policy_id": "policy-id",
  "download_url": "/api/datasets/0xdemo1/stream",
  "blob_id": "full-0xdemo1",
  "expires_at": 1704197100000
}
```

**Status Codes:**
- `200` - Access granted
- `401` - Invalid or missing token
- `403` - Purchase required
- `404` - Dataset not found
- `500` - Server error

---

### GET /api/datasets/:id/preview

Stream preview audio (public, no auth required).

**Query Parameters:**
- `Range` (optional): HTTP Range request support for seeking

**Response:**
- Audio stream (audio/mpeg)
- HTTP 206 if Range requested
- HTTP 200 for full preview

**Status Codes:**
- `200` / `206` - Stream successful
- `404` - Preview not found
- `500` - Stream error

---

### GET /api/datasets/:id/stream

Stream full audio with Range support (requires JWT + ownership).

**Headers:**
```
Authorization: Bearer {token}
Range: bytes=0-1048575 (optional)
```

**Response:**
- Audio stream (audio/mpeg)
- HTTP 206 for partial content (Range requests)
- HTTP 200 for full stream

**Status Codes:**
- `200` / `206` - Stream successful
- `401` - Invalid or missing token
- `403` - Purchase required
- `404` - Audio file not found
- `500` - Stream error

---

## Health & Status

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "database": true,
  "walrus": true
}
```

**Status Codes:**
- `200` - Service healthy
- `503` - Service degraded

---

## Error Responses

All errors follow a standard format:

```json
{
  "error": "ERROR_CODE",
  "code": "ERROR_CODE",
  "message": "Human-readable error message"
}
```

### Error Codes

| Code | Meaning | HTTP Status |
|------|---------|------------|
| `MISSING_AUTH` | No authorization header | 401 |
| `INVALID_TOKEN` | Token expired or invalid | 401 |
| `INVALID_SIGNATURE` | Wallet signature invalid | 401 |
| `NONCE_EXPIRED` | Challenge nonce expired | 401 |
| `NONCE_INVALID` | Challenge nonce invalid | 401 |
| `PURCHASE_REQUIRED` | Dataset requires purchase | 403 |
| `UNAUTHORIZED` | Insufficient permissions | 403 |
| `DATASET_NOT_FOUND` | Dataset doesn't exist | 404 |
| `BLOB_NOT_FOUND` | Audio file not found | 404 |
| `INVALID_REQUEST` | Malformed request | 400 |
| `INTERNAL_ERROR` | Server error | 500 |
| `SERVICE_UNAVAILABLE` | Service temporarily down | 503 |
| `DATABASE_ERROR` | Database error | 500 |
| `WALRUS_ERROR` | Storage service error | 500 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |

---

## Rate Limiting

- **Global**: 100 requests/minute per IP
- **Auth endpoints**: 10 requests/minute per IP
- **Access endpoint**: 10 requests/minute per user
- **Stream endpoint**: 10 requests/minute per user

---

## Caching

- **Preview**: Cached for 24 hours (public)
- **Full audio**: No cache (streamed live with Range support)
- **Purchase verification**: Cached for 5 minutes per user-dataset

---

## Example Workflow

### 1. Request Challenge

```bash
curl -X POST http://localhost:3001/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"address":"0x123abc..."}'
```

### 2. Sign Message with Wallet

User signs the returned message with their wallet.

### 3. Verify Signature

```bash
curl -X POST http://localhost:3001/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "address":"0x123abc...",
    "signature":"base64...",
    "nonce":"550e8400-...",
    "message":"Sign this message to authenticate...\n\nAddress: 0x123abc...\nNonce: 550e8400-...\nExpires: ..."
  }'
```

### 4. Get Access Grant

```bash
curl -X POST http://localhost:3001/api/datasets/0xdemo1/access \
  -H "Authorization: Bearer {token}"
```

### 5. Stream Preview (Public)

```bash
curl http://localhost:3001/api/datasets/0xdemo1/preview \
  -H "Range: bytes=0-1048575" \
  -o preview.mp3
```

### 6. Stream Full Audio (Protected)

```bash
curl http://localhost:3001/api/datasets/0xdemo1/stream \
  -H "Authorization: Bearer {token}" \
  -H "Range: bytes=0-" \
  -o full.mp3
```

---

## Future Enhancements

- [ ] Seal decryption endpoint
- [ ] Download progress tracking
- [ ] Request signing with specific message format
- [ ] Enhanced purchase verification
- [ ] Admin endpoints for blob management
- [ ] Webhook support for purchase events
