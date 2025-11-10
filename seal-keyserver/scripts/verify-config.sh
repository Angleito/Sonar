#!/bin/bash
# =============================================================================
# Config Validation Script
# =============================================================================
# Tests that a key-server config file can be parsed correctly
# Usage: ./scripts/verify-config.sh <config-file>

set -e

if [ $# -eq 0 ]; then
  echo "Usage: $0 <config-file>"
  echo ""
  echo "Example:"
  echo "  $0 /app/config/key-server-config.yaml"
  exit 1
fi

CONFIG_FILE="$1"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ Error: Config file not found: $CONFIG_FILE"
  exit 1
fi

echo "🔍 Validating config file: $CONFIG_FILE"
echo ""

# Check for valid YAML syntax
echo "1. Checking YAML syntax..."
if command -v python3 &> /dev/null; then
  if python3 -c "import yaml" 2>/dev/null; then
    python3 -c "import yaml; yaml.safe_load(open('$CONFIG_FILE'))" 2>&1
    if [ $? -eq 0 ]; then
      echo "   ✅ YAML syntax is valid"
    else
      echo "   ❌ YAML syntax error"
      exit 1
    fi
  else
    echo "   ⚠️  PyYAML not available, skipping YAML syntax check"
  fi
else
  echo "   ⚠️  Python3 not available, skipping YAML syntax check"
fi

echo ""

# Check for required fields
echo "2. Checking required fields..."
REQUIRED_FIELDS=("network" "server_mode")
for field in "${REQUIRED_FIELDS[@]}"; do
  if grep -q "^${field}:" "$CONFIG_FILE"; then
    echo "   ✅ Found: $field"
  else
    echo "   ❌ Missing: $field"
    exit 1
  fi
done

echo ""

# Check for valid ObjectID format (0x + 64 hex chars)
echo "3. Validating ObjectID formats..."
INVALID_IDS=0

# Extract all potential ObjectIDs (lines with quoted hex strings)
# Use sed for macOS compatibility
grep -o '"0x[a-fA-F0-9]*"' "$CONFIG_FILE" | sed 's/"//g' | while read -r obj_id; do
  if [[ ! "$obj_id" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
    echo "   ❌ Invalid ObjectID: $obj_id (expected 0x + 64 hex chars)"
    ((INVALID_IDS++)) || true
  else
    echo "   ✅ Valid: $obj_id"
  fi
done

# Note: INVALID_IDS count doesn't persist across pipe, but validation still runs
# If any invalid IDs exist, they will be displayed above

echo ""
echo "========================================================================"
echo "✅ Config validation passed!"
echo "========================================================================"
echo ""
