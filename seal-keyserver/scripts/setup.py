#!/usr/bin/env python3
"""
Setup script for seal-keyserver runtime environment
Handles file copying and permission setting
"""
import os
import sys
import shutil
import stat
from pathlib import Path


def setup_runtime():
    """Set up the runtime environment - verify files and set permissions."""
    print("🔧 Verifying runtime environment...")
    
    # Verify binaries exist and set permissions
    binaries = [
        "/opt/key-server/bin/key-server",
        "/opt/key-server/bin/seal-cli"
    ]
    
    all_present = True
    for binary in binaries:
        binary_path = Path(binary)
        if binary_path.exists():
            os.chmod(binary, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
            size = binary_path.stat().st_size
            print(f"   ✓ Binary found: {binary} ({size:,} bytes)")
        else:
            print(f"   ❌ Error: Binary not found: {binary}")
            all_present = False
    
    # Verify and set permissions on scripts
    scripts = [
        "/app/start.sh",
        "/app/scripts/verify-config.sh",
    ]
    
    for script in scripts:
        script_path = Path(script)
        if script_path.exists():
            os.chmod(script, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
            print(f"   ✓ Script ready: {script}")
        else:
            print(f"   ⚠️  Warning: Script not found: {script}")
    
    # Verify config files
    config_files = [
        "/app/config/template.yaml",
        "/app/config/template-open.yaml",
    ]
    
    for config in config_files:
        if Path(config).exists():
            print(f"   ✓ Config found: {config}")
        else:
            print(f"   ⚠️  Warning: Config not found: {config}")
    
    if not all_present:
        print("\n❌ Error: Required binaries are missing")
        print("   Check the build logs for compilation errors")
        return False
    
    print("\n✅ Runtime environment verified and ready")
    return True


if __name__ == "__main__":
    if not setup_runtime():
        sys.exit(1)

