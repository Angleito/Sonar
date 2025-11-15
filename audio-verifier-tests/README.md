# Audio Verifier API Tests

Comprehensive API integration tests for the SONAR audio-verifier service using TypeScript and bun:test.

## Overview

This test suite provides end-to-end API testing for the audio-verifier service with:

- **Health Checks** - Service availability and configuration validation
- **Authentication** - Bearer token validation and access control
- **Verification API** - Complete encrypted blob verification flow
- **Status Polling** - Session state tracking and result retrieval
- **End-to-End Workflows** - Full verification lifecycle testing
- **Concurrent Operations** - Multi-session handling and race conditions
- **Error Handling** - Timeout recovery and error states

## Quick Start

### Installation

```bash
cd audio-verifier-tests
bun install
```

### Configuration

Set environment variables:

```bash
# Service configuration
export AUDIO_VERIFIER_URL=http://localhost:8000
export AUDIO_VERIFIER_API_KEY=your-api-key-here
export TEST_TIMEOUT=30000
```

### Running Tests

```bash
# All tests
bun test

# Specific test file
bun test tests/health.test.ts

# Health checks only
bun test tests/health.test.ts

# Verification endpoint tests
bun test tests/verify.test.ts

# Authentication tests
bun test tests/authentication.test.ts

# End-to-end workflows
bun test tests/e2e/full-flow.test.ts

# Watch mode (re-run on changes)
bun test --watch

# With coverage
bun test --coverage
```

## Test Files

### `tests/health.test.ts`
Tests service health endpoints:
- `GET /` - Service info endpoint
- `GET /health` - Health check with config validation
- Response structure validation
- Performance baseline checks

### `tests/authentication.test.ts`
Tests authentication and authorization:
- Bearer token requirement
- Invalid token rejection
- Token format validation
- Per-endpoint auth checks
- Case sensitivity

### `tests/verify.test.ts`
Tests main verification endpoint:
- **POST /verify** - Create verification session
  - Encrypted blob metadata validation
  - Required field checks
  - Session ID generation
  - Async processing response
  
- **GET /verify/{id}** - Poll session status
  - Status retrieval
  - Progress tracking (0-1 range)
  - Stage information
  - Result retrieval on completion
  - Error details on failure
  
- **POST /verify/{id}/cancel** - Cancel verification
  - Session cancellation
  - Error handling

### `tests/e2e/full-flow.test.ts`
End-to-end workflow tests:
- **Complete Flow** - Create → Poll → Handle Results
- **Session Lifecycle** - Progress through stages
- **Concurrent Operations** - Multiple sessions simultaneously
- **Error Recovery** - Transient failure handling
- **State Consistency** - Stable results across multiple queries

## Test Structure

Each test file uses bun:test's `describe` and `it` functions:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";

describe("Feature Name", () => {
  it("does something specific", async () => {
    // Test code
    expect(result).toBe(expected);
  });
});
```

## Helper Functions

Import helpers from `tests/helpers.ts`:

```typescript
import {
  ApiClient,           // HTTP client with auth
  getTestConfig,       // Load config from env
  expectStatus,        // Assert HTTP status
  expectJsonResponse,  // Assert response structure
  generateTestAudio,   // Create synthetic audio
  waitForCondition,    // Poll until condition met
} from "./helpers";
```

### ApiClient Usage

```typescript
const config = getTestConfig();
const client = new ApiClient(config);

// GET request
const response = await client.get("/verify/session-id");

// POST request
const response = await client.post("/verify", {
  blob_id: "...",
  identity: "0x123",
  encrypted_object_bcs: "abcd",
});

// Check status
expectStatus(response.status, 200);
expectStatus(response.status, [200, 202]); // Accept either

// Parse response
const data = expectJsonResponse(response.data);
```

### Polling for Status

```typescript
await waitForCondition(
  async () => {
    const response = await client.get(`/verify/${sessionId}`);
    if (response.status === 200) {
      return response.data.status === "completed";
    }
    return false;
  },
  30000,  // Max wait: 30 seconds
  1000    // Check every second
);
```

## Environment Variables

```bash
# Required
AUDIO_VERIFIER_URL=http://localhost:8000
AUDIO_VERIFIER_API_KEY=your-api-key

# Optional
TEST_TIMEOUT=30000  # HTTP timeout in ms (default: 30s)
```

## Expected Response Formats

### POST /verify Response
```json
{
  "session_id": "uuid-string",
  "estimated_time": 60,
  "status": "processing",
  "progress": 0.0
}
```

### GET /verify/{id} Response
```json
{
  "session_id": "uuid-string",
  "status": "processing|completed|failed|cancelled",
  "progress": 0.0 to 1.0,
  "stage": "quality|copyright|transcription|analysis",
  "results": {
    "approved": true|false,
    "quality": {...},
    "copyright": {...},
    "analysis": {...}
  },
  "error": "error message (if failed)"
}
```

## Test Coverage

### API Endpoints
- ✅ `GET /` - Service info
- ✅ `GET /health` - Health check
- ✅ `POST /verify` - Create session
- ✅ `GET /verify/{id}` - Get status
- ✅ `POST /verify/{id}/cancel` - Cancel session
- ⚠️ `POST /check-audio` - Legacy endpoint (auth only)
- ⚠️ `POST /check-audio-url` - Legacy endpoint (auth only)

### Scenarios
- ✅ Happy path verification flow
- ✅ Authentication validation
- ✅ Input validation and error handling
- ✅ Concurrent session handling
- ✅ Status polling and progress tracking
- ✅ Session cancellation
- ✅ Error recovery and retry logic
- ✅ Response structure validation
- ✅ Performance baseline checks

## Performance Baselines

Expected response times:
- `GET /` - < 100ms
- `GET /health` - < 100ms  
- `POST /verify` - < 2s (async processing)
- `GET /verify/{id}` - < 1s (database lookup)
- Full verification - varies by audio (typically 30-60s)

## Debugging Tests

### Run with verbose output
```bash
bun test --verbose
```

### Run single test
```bash
bun test tests/health.test.ts -t "returns service info"
```

### Check API endpoint directly
```bash
# Test health endpoint
curl -H "Authorization: Bearer your-key" http://localhost:8000/health | jq

# Create session
curl -X POST http://localhost:8000/verify \
  -H "Authorization: Bearer your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "blob_id": "test-blob",
    "identity": "0x123",
    "encrypted_object_bcs": "abcd"
  }' | jq
```

### Enable debug logging in tests

Add to test:
```typescript
console.log("API Response:", response);
console.log("Status:", response.status);
console.log("Data:", response.data);
```

## Common Issues

### "Connection refused" Error
- Verify audio-verifier service is running on configured URL
- Check `AUDIO_VERIFIER_URL` environment variable
- Try: `curl http://localhost:8000/health`

### "401 Unauthorized" Error
- Check `AUDIO_VERIFIER_API_KEY` is set correctly
- Verify API key matches server configuration
- Check Bearer token format in Authorization header

### "Timeout" Error
- Audio-verifier might be processing slowly
- Increase `TEST_TIMEOUT` environment variable
- Check server logs for errors
- Try with simpler test data

### Tests Pass Locally But Fail in CI
- Check environment variables are set in CI
- Verify network connectivity to audio-verifier
- Check for race conditions (use `--serial` flag)
- Review CI logs for timing issues

## CI/CD Integration

### GitHub Actions
Tests run automatically on:
- Pull requests to main/develop
- Pushes to main/develop
- Manual workflow dispatch

Configuration: `.github/workflows/audio-verifier-tests.yml`

### Running in CI

```bash
# Set environment variables
export AUDIO_VERIFIER_URL=http://audio-verifier-service:8000
export AUDIO_VERIFIER_API_KEY=${{ secrets.AUDIO_VERIFIER_API_KEY }}

# Run tests with coverage
bun test --coverage

# Generate JSON report
bun test --reporter json > test-results.json
```

## Adding New Tests

### Create new test file
```bash
touch tests/new-feature.test.ts
```

### Write test
```typescript
import { describe, it, expect } from "bun:test";
import { ApiClient, getTestConfig } from "./helpers";

describe("New Feature", () => {
  const client = new ApiClient(getTestConfig());

  it("does something new", async () => {
    const response = await client.post("/endpoint", { data: "test" });
    expect(response.status).toBe(200);
  });
});
```

### Run test
```bash
bun test tests/new-feature.test.ts
```

## Resources

- [bun:test documentation](https://bun.sh/docs/test/write)
- [axios API documentation](https://axios-http.com/docs/intro)
- [Zod validation](https://zod.dev)

## Troubleshooting

### Test hangs/times out
- Check if audio-verifier is responsive: `curl -v http://localhost:8000/`
- Review server logs for errors
- Increase timeout: `export TEST_TIMEOUT=60000`
- Run individual test to isolate issue

### Flaky tests
- Increase wait times in polling tests
- Use `--serial` flag to run sequentially instead of parallel
- Check server resource usage during tests

### Memory/Performance issues
- Run fewer concurrent tests
- Reduce test audio file sizes
- Monitor server during test execution
- Check for resource leaks in service

## Contributing

1. Write tests for new features
2. Ensure all tests pass locally
3. Add documentation for new test files
4. Include performance expectations
5. Update this README with new test coverage

## License

Same as parent SONAR project
