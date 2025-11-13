#!/bin/bash
set -e

# Build script for sonar-audio-verifier
# Supports multiple build methods: UV (default), Nix, or Bazel

BUILD_METHOD="${BUILD_METHOD:-uv}"

echo "🔨 Building Python application using ${BUILD_METHOD}..."

case "$BUILD_METHOD" in
  uv)
    echo "Using UV build..."
    if command -v uv >/dev/null 2>&1; then
      uv pip install --system .
    else
      echo "❌ Error: uv not found. Install UV from https://github.com/astral-sh/uv"
      exit 1
    fi
    ;;
    
  nix)
    echo "Using Nix build..."
    if command -v nix-shell >/dev/null 2>&1; then
      nix-shell default.nix --run "uv pip install --system ."
    else
      echo "❌ Error: nix-shell not found. Install Nix from https://nixos.org/download.html"
      exit 1
    fi
    ;;
    
  bazel)
    echo "Using Bazel build..."
    if command -v bazel >/dev/null 2>&1; then
      bazel build //:application
    else
      echo "❌ Error: bazel not found. Install Bazel from https://bazel.build/install"
      exit 1
    fi
    ;;
    
  *)
    echo "❌ Error: Unknown build method: $BUILD_METHOD"
    echo "Supported methods: uv, nix, bazel"
    exit 1
    ;;
esac

echo "✅ Build complete"
echo "Verifying installation..."
python3.14 -c "import main; print('  ✓ main module found')" || (echo "  ✗ main module not found" && exit 1)
python3.14 -c "import fastapi; print('  ✓ fastapi found')" || (echo "  ✗ fastapi not found" && exit 1)

