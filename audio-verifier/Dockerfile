# =============================================================================
# SONAR Audio Verifier Dockerfile
# Multi-stage build using Nix for reproducible builds
# =============================================================================
# Comprehensive audio verification service:
# - Quality analysis (duration, sample rate, clipping, silence)
# - Copyright detection (Chromaprint + AcoustID)
# - AI transcription (Gemini)
# - Content safety & quality analysis (Gemini)

# Stage 1: Nix-based builder
FROM nixos/nix:latest AS builder

# Enable Nix flakes and configure cache
RUN mkdir -p /etc/nix && \
    echo "experimental-features = nix-command flakes" >> /etc/nix/nix.conf && \
    echo "auto-optimise-store = true" >> /etc/nix/nix.conf && \
    echo "sandbox = false" >> /etc/nix/nix.conf

WORKDIR /build

# Install Python 3.14, UV, build tools, and system dependencies via nix-env
RUN nix-env -iA nixpkgs.python314 nixpkgs.uv nixpkgs.gcc nixpkgs.rustc nixpkgs.cargo nixpkgs.pkg-config nixpkgs.git nixpkgs.openssl nixpkgs.zlib

# Copy project files
COPY pyproject.toml .
COPY *.py .

# Install Python dependencies using UV
# This will compile pysui-fastcrypto and other packages that need build tools
RUN uv pip install --system .

# Verify installation
RUN python3.14 -c "import main; print('✓ Application installed successfully')" && \
    python3.14 -c "import fastapi; print('✓ FastAPI available')" && \
    python3.14 -c "import librosa; print('✓ Librosa available')" && \
    python3.14 -c "import pysui; print('✓ PySui available')"

# Stage 2: Runtime image (NixOS-based for library compatibility)
FROM nixos/nix:latest AS runtime

# Enable Nix flakes and configure cache (same as builder stage)
RUN mkdir -p /etc/nix && \
    echo "experimental-features = nix-command flakes" >> /etc/nix/nix.conf && \
    echo "auto-optimise-store = true" >> /etc/nix/nix.conf && \
    echo "sandbox = false" >> /etc/nix/nix.conf

# Install runtime dependencies using nix-env
# Python 3.14, UV, build tools (needed for pysui-fastcrypto), and system libraries for audio processing
RUN nix-env -iA nixpkgs.python314 nixpkgs.uv nixpkgs.gcc nixpkgs.rustc nixpkgs.cargo nixpkgs.pkg-config nixpkgs.ffmpeg nixpkgs.chromaprint nixpkgs.libsndfile nixpkgs.curl nixpkgs.shadow nixpkgs.coreutils nixpkgs.openssl nixpkgs.zlib

# Create directory for application
WORKDIR /app

# Copy application source code
COPY pyproject.toml .
COPY *.py .

# Install Python dependencies in runtime stage
# UV will use cached wheels from pip cache if available, but will reinstall
# This ensures all paths are correct for the runtime environment
RUN uv pip install --system .

# Create temp directory for audio processing with proper permissions
# Used by verification pipeline for Gemini uploads
RUN mkdir -p /tmp/audio-verifier && chmod 1777 /tmp/audio-verifier

# Create non-root user for runtime
# Initialize system files needed for useradd (NixOS minimal image doesn't have them)
RUN mkdir -p /etc && \
    touch /etc/passwd /etc/group /etc/shadow /etc/gshadow && \
    chmod 644 /etc/passwd /etc/group && \
    chmod 600 /etc/shadow /etc/gshadow && \
    echo "root:x:0:0:root:/root:/bin/sh" >> /etc/passwd && \
    echo "root:x:0:" >> /etc/group && \
    useradd --create-home --shell /bin/false --uid 1000 verifier && \
    chown -R verifier:root /app /tmp/audio-verifier && \
    chmod 755 /app

USER verifier
ENV HOME=/home/verifier
WORKDIR /app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python3.14 -c "import httpx; httpx.get('http://localhost:8000/health', timeout=5.0)"

# Start server with 2 workers for production
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
