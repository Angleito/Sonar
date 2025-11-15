# Audio Verifier Test Suite

Comprehensive test suite for the SONAR audio verification service using pytest, hypothesis for property-based testing, and httpx-mock for HTTP mocking.

## Overview

The test suite is organized into three levels:

1. **Unit Tests** - Test individual functions and classes in isolation
2. **Integration Tests** - Test API endpoints and multi-component workflows
3. **Property-Based Tests** - Use hypothesis to verify invariants with generated test data

## Installation

### Install Test Dependencies

```bash
cd audio-verifier
pip install -e '.[dev]'
```

This installs:
- `pytest` - Test runner
- `pytest-asyncio` - Async test support
- `pytest-timeout` - Detect hanging tests
- `pytest-cov` - Code coverage reporting
- `hypothesis` - Property-based testing
- `httpx-mock` - HTTP mocking

## Running Tests

### Run All Tests

```bash
pytest
```

### Run Specific Test Categories

```bash
# Unit tests only
pytest tests/unit/

# Integration tests
pytest tests/integration/

# Property-based tests
pytest tests/property/

# Specific test file
pytest tests/unit/test_seal_decryptor.py

# Specific test class
pytest tests/unit/test_seal_decryptor.py::TestDecryptWithSealCli

# Specific test
pytest tests/unit/test_seal_decryptor.py::TestDecryptWithSealCli::test_decrypt_with_key_server_ids
```

### Run with Options

```bash
# Show print statements
pytest -s

# Verbose output
pytest -v

# Run with code coverage
pytest --cov=. --cov-report=html --cov-report=term

# Stop on first failure
pytest -x

# Run only failing tests (from last run)
pytest --lf

# Run tests matching pattern
pytest -k "seal" -v

# Run with timeout (10 seconds)
pytest --timeout=10

# Run property-based tests with specific settings
pytest tests/property/ --hypothesis-profile=dev
```

## Test Structure

### Unit Tests (`tests/unit/`)

#### `test_seal_decryptor.py` - CRITICAL for 502 Error Debugging

Tests for encrypted blob decryption with Seal and AES:

- **Configuration Validation** - Verify required env vars (SEAL_PACKAGE_ID, SEAL_KEY_SERVER_IDS, etc.)
- **Walrus Blob Fetching** - Test 15s initial wait, 10x retries with 30s delays, timeout handling
- **seal-cli Subprocess** - Test command construction, output parsing, error handling, 60s timeout
- **AES-256-GCM Decryption** - Test valid/invalid keys, IV handling
- **Timeout Scenarios** - Tests marked with `@pytest.mark.timeout()` to detect hangs causing 502 errors

**Critical Tests for 502 Debugging:**
- `test_walrus_fetch_timeout_bounded` - Ensures fetch doesn't exceed 350s total
- `test_seal_cli_timeout_raises_error` - Verifies timeout is handled
- `test_does_not_hang_on_blob_fetch` - Detects hanging operations
- `test_sync_decryption_completes_quickly` - Performance check

#### `test_audio_checker.py`

Tests audio quality checks:

- **Duration Validation** - Tests <1s rejection, >3600s rejection, valid ranges
- **Sample Rate** - Tests <8000Hz rejection, valid rates
- **Clipping Detection** - Tests >0.99 amplitude detection
- **Silence Detection** - Tests >30% silence rejection
- **Volume Validation** - Tests <-40dB and >-6dB rejection
- **Error Handling** - Tests corrupted files, empty files, missing files
- **Streaming Performance** - Tests that large files don't cause memory spikes

#### `test_fingerprint.py`

Tests copyright detection via AcoustID:

- **High-Confidence Matches** - Tests >80% confidence detection
- **Low-Confidence Ignored** - Tests <80% confidence ignored
- **Multiple Matches** - Tests sorting, limiting to 5 results
- **Error Handling** - Network errors, invalid API keys, Chromaprint failures
- **Temp File Cleanup** - Verifies files are cleaned up even on errors

#### `test_verification_pipeline.py`

Tests the 6-stage verification pipeline:

- **Stage 1: Quality Check** - Tests execution and fail-fast
- **Stage 2: Copyright Check** - Tests AcoustID integration
- **Stage 3: Transcription** - Tests OpenRouter Voxtral API calls, base64 encoding
- **Stage 4: Analysis** - Tests Gemini Flash API, JSON parsing, safe defaults
- **Stage 5-6: Aggregation & Finalization** - Tests approval logic
- **Approval Calculation** - Tests all checks must pass
- **Temp File Handling** - Tests cleanup in context managers
- **Timeout Scenarios** - Full pipeline should complete within 30s

#### `test_session_store.py`

Tests PostgreSQL session storage:

- **Session Lifecycle** - Create, update, retrieve, complete, fail
- **Database Operations** - Mocked asyncpg for async DB testing
- **Error Handling** - Connection failures, constraint violations
- **Concurrent Access** - Multiple sessions simultaneously

### Property-Based Tests (`tests/property/`)

#### `test_audio_properties.py`

Uses hypothesis to generate test audio with various parameters:

- **Valid Audio Parameters** - Tests any combination of valid duration/sample rate
- **Clipping Detection Monotonic** - Clipping increases with amplitude
- **Duration Calculation Accurate** - Duration detection within 2% across all rates
- **Silence Detection Threshold** - Consistent threshold application
- **Quality Score Valid Range** - Always in 0-1 range
- **Repeated Checks Consistent** - Same audio → same results

#### `test_pipeline_invariants.py`

Tests pipeline invariants with generated inputs:

- **Approval Deterministic** - Same inputs → same output
- **Approval Logic Completeness** - Verifies defined rules are followed
- **Copyright Threshold** - Verifies 80% threshold exactly
- **Quality Requirement** - Approval impossible if quality fails
- **Safety Requirement** - Approval impossible if safety fails
- **Quality Score Clamping** - Always clamped to [0, 1]
- **Response Parsing Robustness** - Extracts JSON from noise
- **Invalid JSON Handling** - Returns safe defaults
- **Progress Monotonicity** - Progress values in valid range
- **Prompt Generation** - Required fields always present
- **Long Transcript Truncation** - Very long transcripts truncated

## Test Coverage Goals

| Module | Current | Target | Priority |
|--------|---------|--------|----------|
| seal_decryptor.py | 0% | 95% | **CRITICAL** |
| audio_checker.py | 20% | 90% | HIGH |
| fingerprint.py | 30% | 85% | HIGH |
| verification_pipeline.py | 0% | 80% | HIGH |
| session_store.py | 0% | 85% | HIGH |
| main.py | 0% | 75% | MEDIUM |

### Generating Coverage Report

```bash
# Generate HTML coverage report
pytest --cov=. --cov-report=html

# Open report
open htmlcov/index.html

# Show coverage in terminal
pytest --cov=. --cov-report=term-missing
```

## Timeout Configuration

Tests use timeouts to detect hanging operations that could cause 502 errors:

- `@pytest.mark.timeout(5)` - Quick operations (should complete instantly)
- `@pytest.mark.timeout(10)` - Normal operations (API calls, file I/O)
- `@pytest.mark.timeout(30)` - Long operations (full pipeline)
- `@pytest.mark.timeout(60)` - Database operations

The global timeout is set via `pytest --timeout=600` (10 minutes) to catch truly hung tests.

## Fixtures

Common fixtures are defined in `conftest.py`:

- **Audio Files** - Valid, clipped, silent, long, short, low-quality audio
- **Mock Objects** - Mocked session stores, API clients, detectors
- **Configurations** - Valid/invalid SEAL configs
- **API Responses** - Mocked OpenRouter, AcoustID responses

## Debugging Failed Tests

### If You See 502 Errors During Testing

1. **Check seal_decryptor tests first**:
   ```bash
   pytest tests/unit/test_seal_decryptor.py -v
   ```

2. **Run with timeout tracking**:
   ```bash
   pytest --timeout=10 -v
   ```

3. **Check for hanging operations**:
   ```bash
   pytest tests/unit/test_seal_decryptor.py::TestTimeoutScenarios -v
   ```

4. **Check Walrus fetch logic**:
   ```bash
   pytest tests/unit/test_seal_decryptor.py::TestFetchWalrusBlob -v
   ```

### If a Property-Based Test Fails

Hypothesis will provide a minimal failing example (shrinking). The error message will show:

```
Falsifying example: test_something(input=...)
```

This example can be rerun to debug the specific case.

### To Reproduce a Specific Property Test Failure

```bash
# Run property tests with specific seed
pytest tests/property/ -v --hypothesis-seed=12345

# Show examples that failed
pytest tests/property/ -v --hypothesis-verbosity=verbose
```

## Continuous Integration

Tests are automatically run on:
- Pull requests (via GitHub Actions)
- Commits to main
- Pre-deployment checks in Railway

To run CI checks locally:

```bash
# Run all tests with coverage
pytest --cov=. --cov-report=term-missing

# Check code quality (if linters installed)
pylint **/*.py
mypy .
```

## Performance Benchmarks

Target completion times for test categories:

- Unit tests: **<5 minutes**
- Integration tests: **<3 minutes**
- Property-based tests: **<5 minutes** (with default hypothesis settings)
- Full suite: **<15 minutes**

For faster feedback, run just the affected tests during development:

```bash
# After editing seal_decryptor.py
pytest tests/unit/test_seal_decryptor.py -v

# After editing verification_pipeline.py
pytest tests/unit/test_verification_pipeline.py -v
```

## Adding New Tests

### Adding a Unit Test

1. Create or edit file in `tests/unit/`
2. Import necessary modules and fixtures from `conftest.py`
3. Write test function starting with `test_`
4. Use descriptive names: `test_<function>_<scenario>_<expectation>`

Example:
```python
@pytest.mark.asyncio
async def test_verify_handles_missing_file(self):
    """Test that verification gracefully handles missing files."""
    with pytest.raises(FileNotFoundError):
        # Test code here
        pass
```

### Adding a Property-Based Test

1. Create or edit file in `tests/property/`
2. Use `@given(...)` decorator with hypothesis strategies
3. Test invariants that should always hold

Example:
```python
from hypothesis import given, strategies as st

@given(duration=st.floats(1.0, 3600.0))
def test_duration_always_valid(duration):
    """Test that durations are always in valid range."""
    assert 1.0 <= duration <= 3600.0
```

## Troubleshooting

### "No module named 'audio_checker'"

Make sure you're in the `audio-verifier` directory and have installed the package:

```bash
pip install -e '.[dev]'
```

### "DATABASE_URL must be set"

For session_store tests, either:
- Set `DATABASE_URL` environment variable
- Tests will be mocked (asyncpg calls are mocked)

### "seal-cli not found"

Tests mock the seal-cli binary. Actual binary needed only for integration tests against real services.

### Hypothesis "Too slow"

For faster test runs during development:

```bash
# Use faster hypothesis profile
pytest tests/property/ --hypothesis-profile=dev

# Or limit examples
pytest tests/property/ --hypothesis-max-examples=100
```

## Resources

- [pytest documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [hypothesis documentation](https://hypothesis.readthedocs.io/)
- [httpx-mock](https://github.com/Colin-b/httpx_mock)
