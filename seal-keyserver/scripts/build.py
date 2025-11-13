#!/usr/bin/env python3
"""
Build verification script for seal-keyserver
Replaces shell scripts with Python for better maintainability
"""
import os
import sys
import subprocess
from pathlib import Path


def verify_binaries(build_dir: Path = Path("seal/target/release")):
    """Verify that required binaries were built successfully."""
    binaries = ["key-server", "seal-cli"]
    missing = []
    
    for binary in binaries:
        binary_path = build_dir / binary
        if not binary_path.exists():
            missing.append(str(binary_path))
        elif not os.access(binary_path, os.X_OK):
            print(f"⚠️  Warning: {binary_path} exists but is not executable")
    
    if missing:
        print("❌ Error: Missing required binaries:")
        for path in missing:
            print(f"   - {path}")
        return False
    
    print("✅ All binaries built successfully")
    for binary in binaries:
        size = (build_dir / binary).stat().st_size
        print(f"   ✓ {binary} ({size:,} bytes)")
    return True


def main():
    """Main entry point."""
    if len(sys.argv) > 1:
        build_dir = Path(sys.argv[1])
    else:
        build_dir = Path("seal/target/release")
    
    if not verify_binaries(build_dir):
        sys.exit(1)


if __name__ == "__main__":
    main()

