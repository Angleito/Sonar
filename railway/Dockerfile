# =============================================================================
# SONAR SEAL Key Server Dockerfile
# =============================================================================
# Auto-generates key material ONLY on first deployment (when MASTER_KEY not set)
# For production: Set MASTER_KEY and KEY_SERVER_OBJECT_ID env vars in Railway
# To reset keys: Delete MASTER_KEY env var and redeploy
# Last updated: 2025-11-09 - Package ID whitelist updated to 0xdff609...

# Build stage
FROM rust:1.83-bullseye AS builder

WORKDIR /work

# Clone SEAL repository
RUN git clone https://github.com/MystenLabs/seal.git . && \
    git checkout main

# Build both seal-cli and key-server
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
RUN cargo build --bin seal-cli --release --config net.git-fetch-with-cli=true && \
    cargo build --bin key-server --release --config net.git-fetch-with-cli=true

# Runtime stage
FROM debian:bullseye-slim AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libpq5 \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy binaries from builder
COPY --from=builder /work/target/release/key-server /opt/key-server/bin/key-server
COPY --from=builder /work/target/release/seal-cli /opt/key-server/bin/seal-cli

# Create config directory
RUN mkdir -p /app/config

# Copy config template and startup script
COPY railway/key-server-config.yaml.example /app/config/template.yaml
COPY railway/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose ports
EXPOSE 2024 9184

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:2024/health || exit 1

# Start key server
CMD ["/app/start.sh"]
