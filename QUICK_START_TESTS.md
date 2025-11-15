# Quick Start: Running the Audio Verifier Test Suite

## 5-Minute Setup

### Python Tests

```bash
# Navigate to audio-verifier directory
cd audio-verifier

# Install test dependencies
pip install -e '.[dev]'

# Run all tests
pytest

# Run with coverage report
pytest --cov=. --cov-report=html
open htmlcov/index.html
```

### TypeScript Tests

```bash
# Navigate to test directory
cd audio-verifier-tests

# Install dependencies
bun install

# Run all tests
bun test

# Run specific test file
bun test tests/health.test.ts
```

## Debugging 502 Errors (Priority Order)

### 1. Test seal_decryptor (CRITICAL)
```bash
cd audio-verifier
pytest tests/unit/test_seal_decryptor.py -v
```
**What it checks:** Timeout handling, Walrus blob fetching, seal-cli execution

### 2. Test timeout scenarios
```bash
pytest -k "timeout" -v --timeout=30
```
**What it checks:** Operations don't exceed 60s limit, async returns quickly

### 3. Test full pipeline
```bash
pytest tests/unit/test_verification_pipeline.py -v
```
**What it checks:** All 6 stages complete, no hangs, proper error handling

### 4. Test against live service
```bash
cd audio-verifier-tests
export AUDIO_VERIFIER_URL=http://localhost:8000
export AUDIO_VERIFIER_API_KEY=your-key
bun test tests/verify.test.ts
```
**What it checks:** Actual API response times and status codes

## Most Important Tests

| Test | Purpose | Command |
|------|---------|---------|
| `test_seal_decryptor.py` | 502 error debugging | `pytest tests/unit/test_seal_decryptor.py` |
| `test_walrus_fetch_timeout_bounded` | Prevents 350s+ hangs | `pytest tests/unit/test_seal_decryptor.py::TestTimeoutScenarios::test_walrus_fetch_timeout_bounded` |
| `test_full_pipeline_timeout_bounded` | Complete flow timeout | `pytest tests/unit/test_verification_pipeline.py::TestTimeoutScenarios::test_full_pipeline_timeout_bounded` |
| `verify.test.ts` | API contract validation | `bun test tests/verify.test.ts` |
| `full-flow.test.ts` | End-to-end workflows | `bun test tests/e2e/full-flow.test.ts` |

## Test Coverage by Issue

### For 502 Bad Gateway Errors
1. Check seal_decryptor tests
2. Check timeout tests
3. Monitor Walrus fetch times
4. Verify seal-cli completes within 60s

### For Slow API Responses
1. Run performance baseline tests
2. Check concurrent operation tests
3. Test large file handling
4. Monitor OpenRouter API calls

### For Database Issues
1. Run session_store tests
2. Check connection pool tests
3. Test concurrent sessions
4. Verify cleanup on errors

### For Audio Processing Issues
1. Run audio_checker tests
2. Test fingerprint detection
3. Check transcription parsing
4. Verify analysis JSON parsing

## Expected Test Results

### All Tests Should Pass
```
===== test session starts =====
collected 200+ items

audio-verifier/tests/ ....
✅ All tests passed
===== 200+ passed in 45.67s =====
```

### If Tests Fail
```bash
# Run failed tests with verbose output
pytest --lf -v

# Run with print statements visible
pytest -s -v

# Run specific failing test
pytest tests/unit/test_module.py::TestClass::test_method -v
```

## Performance Expectations

| Operation | Expected | Max Allowed |
|-----------|----------|------------|
| Python unit tests | < 2 minutes | 5 minutes |
| Python property tests | < 3 minutes | 10 minutes |
| TypeScript tests | < 1 minute | 3 minutes |
| Full suite | < 15 minutes | 30 minutes |

## Environment Variables

### Required for Live API Tests
```bash
export AUDIO_VERIFIER_URL=http://localhost:8000
export AUDIO_VERIFIER_API_KEY=your-api-key
```

### Optional
```bash
export TEST_TIMEOUT=30000  # HTTP request timeout (ms)
```

## Common Commands

### Run specific test category
```bash
# Authentication tests
pytest tests/unit/test_seal_decryptor.py -v

# Property tests only
pytest tests/property/ -v

# Integration tests
bun test tests/e2e/

# Health checks
bun test tests/health.test.ts
```

### Generate reports
```bash
# Coverage report
pytest --cov=. --cov-report=html
open htmlcov/index.html

# JUnit XML (for CI)
pytest --junit-xml=results.xml

# JSON report
bun test --reporter json > results.json
```

### Debug specific issue
```bash
# Run with detailed output
pytest -vv -s tests/unit/test_seal_decryptor.py

# Show slowest tests
pytest --durations=10

# Stop on first failure
pytest -x

# Run only failed tests
pytest --lf -v
```

## Troubleshooting

### "No module named 'audio_checker'"
```bash
cd audio-verifier
pip install -e '.[dev]'
```

### "Connection refused" (TypeScript tests)
```bash
# Make sure service is running
curl http://localhost:8000/
# If not, start it:
cd audio-verifier
python -m uvicorn main:app --reload
```

### "401 Unauthorized" (TypeScript tests)
```bash
# Set API key
export AUDIO_VERIFIER_API_KEY=your-key
bun test tests/health.test.ts
```

### "Timeout" errors
```bash
# Increase timeout
export TEST_TIMEOUT=60000
bun test
```

## What Each Test Directory Covers

### `audio-verifier/tests/unit/`
- Individual functions and classes
- Mock external services
- Error handling
- Edge cases

### `audio-verifier/tests/property/`
- Invariants with generated test data
- Determinism
- Range/boundary validation
- Consistency

### `audio-verifier-tests/tests/`
- HTTP API contracts
- Authentication
- Response formats
- Performance

### `audio-verifier-tests/tests/e2e/`
- Complete workflows
- Concurrent operations
- Error recovery
- State consistency

## Pre-Deployment Checklist

- [ ] All Python unit tests pass
- [ ] All TypeScript integration tests pass
- [ ] Coverage reports generated
- [ ] Performance baseline acceptable
- [ ] No timeout issues detected
- [ ] No database connection issues
- [ ] Error handling tested
- [ ] API contract validated

## Further Reading

- **Detailed guide:** See `TEST_SUITE_SUMMARY.md`
- **Python tests:** See `audio-verifier/tests/README.md`
- **TypeScript tests:** See `audio-verifier-tests/README.md`
- **502 debugging:** See `audio-verifier/tests/unit/test_seal_decryptor.py`

## Quick Questions?

### "How do I fix 502 errors?"
1. Run `pytest tests/unit/test_seal_decryptor.py -v`
2. Check timeout tests pass
3. Verify Walrus connectivity
4. Check seal-cli is installed and working

### "Are the tests flaky?"
Tests should be deterministic. If they fail intermittently:
1. Increase timeouts
2. Run sequentially: `pytest --timeout=60`
3. Check server logs

### "How do I add a new test?"
1. Create test file in appropriate directory
2. Use existing fixtures from conftest.py
3. Follow naming convention: `test_<feature>_<scenario>`
4. Run test locally before committing

## Status

✅ **Complete test suite with 200+ tests**
✅ **Python unit + property tests**
✅ **TypeScript API integration tests**
✅ **CI/CD configuration**
✅ **502 error debugging tests**
✅ **Performance baseline validation**

Ready to use! Start with the "5-Minute Setup" above.
