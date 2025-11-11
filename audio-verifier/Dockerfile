# =============================================================================
# SONAR Audio Verifier Dockerfile
# =============================================================================
# Comprehensive audio verification service:
# - Quality analysis (duration, sample rate, clipping, silence)
# - Copyright detection (Chromaprint + AcoustID)
# - AI transcription (Gemini)
# - Content safety & quality analysis (Gemini)

FROM python:3.11-slim

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y \
    libchromaprint-tools \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /usr/sbin/nologin --uid 1000 verifier

WORKDIR /app

# Copy project files
COPY pyproject.toml .
COPY *.py .

# Install Python dependencies
# Note: Install the project itself, not treating pyproject.toml as requirements.txt
RUN pip install --no-cache-dir .

# Create temp directory for audio processing with proper permissions
# Used by verification pipeline for Gemini uploads
RUN mkdir -p /tmp/audio-verifier && chmod 1777 /tmp/audio-verifier

RUN chown -R verifier:verifier /app && \
    chown -R verifier:verifier /tmp/audio-verifier

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import httpx; httpx.get('http://localhost:8000/health', timeout=5.0)"

# Start server with 2 workers for production
USER verifier
ENV HOME=/home/verifier
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
