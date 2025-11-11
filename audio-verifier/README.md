# SONAR Audio Verifier Service

Comprehensive audio verification service for the SONAR Protocol. Verifies audio quality, copyright, transcription, and content safety **before** encryption and blockchain publication.

## Features

- **Quality Analysis**: Sample rate, duration, clipping, silence detection
- **Copyright Detection**: Chromaprint + AcoustID fingerprinting
- **AI Transcription**: Google Gemini 2.0 Flash for speech-to-text
- **Content Analysis**: AI-powered quality scoring and safety screening using Gemini
- **Stateful Pipeline**: Progress tracking via Vercel KV
- **Secure**: Bearer token authentication, CORS protection, file size limits

## Architecture

```
Upload Flow (NEW):
User → File Selection → Metadata → Verification → Encryption → Publish
                                        ↓
                              Audio Verifier Service
                              (Quality + Copyright + Gemini AI)
```

**Key Difference**: Verification now runs on **raw audio** before encryption, ensuring the service can actually analyze the content.

## Quick Start

### 1. Install Dependencies

```bash
cd audio-verifier
pip install -e .
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `ACOUSTID_API_KEY` - Get free key at https://acoustid.org/api-key
- `GEMINI_API_KEY` - Get at https://aistudio.google.com/app/apikey
- `KV_REST_API_URL` - Vercel KV REST API URL
- `KV_REST_API_TOKEN` - Vercel KV authentication token
- `VERIFIER_AUTH_TOKEN` - Random 256-bit token (generate with `openssl rand -hex 32`)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed frontend origins

### 3. Run Locally

```bash
# Development mode
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Or using Docker
docker build -t sonar-audio-verifier .
docker run -p 8000:8000 --env-file .env sonar-audio-verifier
```

### 4. Test the Service

```bash
# Health check
curl http://localhost:8000/health

# Verify an audio file
curl -X POST http://localhost:8000/verify \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@sample.wav" \
  -F 'metadata={"title":"Test","description":"Test dataset","languages":["en"],"tags":["test"]}'

# Check verification status
curl http://localhost:8000/verify/{verificationId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## API Endpoints

### POST /verify

Start comprehensive audio verification.

**Request:**
- `file`: Raw audio file (multipart/form-data)
- `metadata`: JSON string with dataset metadata

**Response:**
```json
{
  "verificationId": "uuid",
  "estimatedTimeSeconds": 45,
  "status": "processing"
}
```

### GET /verify/{id}

Get verification status and results.

**Response:**
```json
{
  "id": "uuid",
  "state": "completed",
  "stage": "analysis",
  "progress": 1.0,
  "approved": true,
  "quality": { "passed": true, "sample_rate": 44100, ... },
  "copyright": { "detected": false, ... },
  "transcript": "Audio transcript...",
  "analysis": { "qualityScore": 0.87, "safetyPassed": true, ... }
}
```

### POST /verify/{id}/cancel

Cancel a running verification.

## Verification Pipeline

The service runs a 6-stage pipeline:

1. **Quality Check** (15% progress)
   - Duration (1s - 1 hour)
   - Sample rate (minimum 8000 Hz)
   - Clipping detection
   - Silence analysis (<30%)
   - Volume levels (-40dB to -6dB)

2. **Copyright Check** (35% progress)
   - Chromaprint fingerprinting
   - AcoustID database lookup
   - High-confidence match detection (>80%)

3. **Transcription** (55% progress)
   - Google Gemini 2.0 Flash audio-to-text
   - Full transcript generation
   - Handles multiple languages

4. **AI Analysis** (75% progress)
   - Quality scoring (0-1 scale) using Gemini
   - Content safety screening
   - Insights and recommendations

5. **Aggregation** (95% progress)
   - Combine all results
   - Calculate final approval:
     ```
     approved = quality.passed &&
                !copyright.high_confidence &&
                safetyPassed
     ```

6. **Finalization** (100% progress)
   - Store results in Vercel KV
   - Return to frontend

## Deployment

### Railway

```bash
# From audio-verifier directory
railway up

# Set environment variables in Railway dashboard
railway variables set GEMINI_API_KEY=xxx
railway variables set KV_REST_API_URL=xxx
railway variables set KV_REST_API_TOKEN=xxx
railway variables set VERIFIER_AUTH_TOKEN=xxx
railway variables set ACOUSTID_API_KEY=xxx
```

### Fly.io

```bash
# Initialize Fly app
fly launch

# Set secrets
fly secrets set GEMINI_API_KEY=xxx
fly secrets set KV_REST_API_URL=xxx
fly secrets set KV_REST_API_TOKEN=xxx
fly secrets set VERIFIER_AUTH_TOKEN=xxx
fly secrets set ACOUSTID_API_KEY=xxx

# Deploy
fly deploy
```

### Docker (Production)

```bash
# Build image
docker build -t sonar-audio-verifier .

# Run with environment file
docker run -p 8000:8000 \
  --env-file .env \
  sonar-audio-verifier
```

## Frontend Integration

After deploying the service, update your frontend environment variables:

```bash
# frontend/.env.local
NEXT_PUBLIC_AUDIO_VERIFIER_URL=https://your-verifier.railway.app
NEXT_PUBLIC_VERIFIER_AUTH_TOKEN=your_random_256_bit_token
```

The frontend `VerificationStep` component automatically:
1. Calls POST /verify with raw audio file
2. Polls GET /verify/{id} for progress
3. Blocks upload if verification fails
4. Provides detailed error feedback with recovery options

## Security

- **Authentication**: Bearer token required for all `/verify` endpoints
- **CORS**: Explicit origin whitelist
- **File Size Limits**: Checked before multipart parsing (max 13GB)
- **Rate Limiting**: Recommended via reverse proxy (Nginx/Cloudflare)

## Monitoring

- **Health Check**: `GET /health` returns configuration status
- **Logs**: Structured logging to stdout (compatible with Railway/Fly)
- **Metrics**: Add Prometheus endpoint for production monitoring

## Troubleshooting

### Verification fails with "Chromaprint not installed"

Install system dependencies:
```bash
apt-get install libchromaprint-tools ffmpeg
```

### Gemini API errors

- Check `GEMINI_API_KEY` is valid
- Verify API quota hasn't been exceeded
- Check file is a supported audio format (WAV, MP3, M4A, etc.)

### Vercel KV connection errors

- Confirm `KV_REST_API_URL` and `KV_REST_API_TOKEN` are correct
- Verify KV instance is active and not rate-limited
- Check network connectivity from deployment environment

### Large file uploads timeout

- Increase worker timeout: `uvicorn main:app --timeout-keep-alive 300`
- Add nginx reverse proxy with extended timeouts
- Consider processing files asynchronously with queues for >100MB files

## Development

Run tests:
```bash
pytest tests/
```

Type checking:
```bash
mypy main.py verification_pipeline.py kv_client.py
```

## License

Part of the SONAR Protocol. See main repository LICENSE.
