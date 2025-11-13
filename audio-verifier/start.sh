#!/bin/bash
set -e

# =============================================================================
# SONAR Audio Verifier Startup Script
# =============================================================================

echo "🔧 Starting SONAR Audio Verifier..."

# Activate virtual environment
source /app/.venv/bin/activate

# Use PORT environment variable if set (for Railway/cloud platforms)
# Otherwise default to 8000
PORT="${PORT:-8000}"

echo "   Port: ${PORT}"
echo "   Workers: 2"
echo ""

# Start uvicorn server
exec /app/.venv/bin/uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT}" \
    --workers 2

