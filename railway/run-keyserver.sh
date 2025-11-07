#!/bin/bash
# =============================================================================
# SONAR SEAL Key Server Local Runner
# =============================================================================
# This script retrieves the master key from macOS Keychain and runs the
# key server locally for testing and deriving the public key.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       🔐 SONAR SEAL Key Server (Local)                   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running from railway directory
if [ ! -f "key-server-config.yaml.example" ]; then
    echo -e "${RED}❌ Error: Must run from railway/ directory${NC}"
    echo -e "${YELLOW}   cd railway && ./run-keyserver.sh${NC}"
    exit 1
fi

# Check if seal directory exists
if [ ! -d "seal" ]; then
    echo -e "${RED}❌ Error: SEAL repository not found${NC}"
    echo -e "${YELLOW}   Run ./setup.sh first${NC}"
    exit 1
fi

echo -e "${BLUE}🔑 Retrieving master key from macOS Keychain...${NC}"

# Retrieve master key from Keychain
MASTER_KEY=$(security find-generic-password -a "angel" -s "sonar-seal-master-key" -w 2>/dev/null)

if [ -z "$MASTER_KEY" ]; then
    echo -e "${RED}❌ Error: Master key not found in Keychain${NC}"
    echo -e "${YELLOW}   Run setup.sh to generate and store a master key${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Master key retrieved from Keychain${NC}"
echo ""

echo -e "${BLUE}🚀 Starting key server locally...${NC}"
echo -e "${YELLOW}   This will derive the public key for index 0${NC}"
echo -e "${YELLOW}   Copy the derived public key from the output below${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Run key server with retrieved master key
cd seal
MASTER_KEY=$MASTER_KEY \
  CONFIG_PATH=../key-server-config.yaml.example \
  cargo run --bin key-server
