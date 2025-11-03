#!/bin/bash
#
# Kiosk Admin Script
# Manages kiosk liquidity pool via Sui CLI
#
# Usage:
#   ./kiosk-admin.sh fund <sonar_amount>       - Fund kiosk with SONAR tokens
#   ./kiosk-admin.sh price <sui_amount>        - Set SONAR price override (in SUI)
#   ./kiosk-admin.sh price-clear               - Clear price override (use dynamic pricing)
#   ./kiosk-admin.sh sui-cut <percentage>      - Set SUI cut percentage (0-100)
#   ./kiosk-admin.sh withdraw <sui_amount>     - Withdraw SUI from kiosk reserve
#   ./kiosk-admin.sh status                    - Check kiosk reserve status
#
# Prerequisites:
#   - Sui CLI installed and configured
#   - AdminCap object ID in environment or passed as argument
#   - Package deployed to testnet/mainnet
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration (can be overridden by environment variables)
NETWORK="${SUI_NETWORK:-testnet}"
PACKAGE_ID="${SUI_PACKAGE_ID:-}"
MARKETPLACE_ID="${SUI_MARKETPLACE_ID:-}"
ADMIN_CAP_ID="${SUI_ADMIN_CAP_ID:-}"
GAS_BUDGET="${SUI_GAS_BUDGET:-100000000}"  # 0.1 SUI

# Helper functions
error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    exit 1
}

info() {
    echo -e "${BLUE}INFO: $1${NC}"
}

success() {
    echo -e "${GREEN}SUCCESS: $1${NC}"
}

warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

check_config() {
    if [ -z "$PACKAGE_ID" ]; then
        error "SUI_PACKAGE_ID not set. Export it or set in .env"
    fi
    if [ -z "$MARKETPLACE_ID" ]; then
        error "SUI_MARKETPLACE_ID not set. Export it or set in .env"
    fi
    if [ -z "$ADMIN_CAP_ID" ]; then
        error "SUI_ADMIN_CAP_ID not set. Export it or set in .env"
    fi
}

# Convert human-readable amount to base units (1 SONAR = 1e9 base units)
to_base_units() {
    local amount=$1
    # Use bc for floating point arithmetic
    echo "scale=0; $amount * 1000000000 / 1" | bc
}

# Fund kiosk with SONAR tokens
fund_kiosk() {
    local sonar_amount=$1
    if [ -z "$sonar_amount" ]; then
        error "Usage: $0 fund <sonar_amount>"
    fi

    check_config

    local base_units
    base_units=$(to_base_units "$sonar_amount")

    info "Funding kiosk with $sonar_amount SONAR ($base_units base units)..."

    # Note: In real implementation, you'd need to select a SONAR coin from wallet
    # For now, this is a placeholder showing the Sui CLI command structure
    sui client call \
        --package "$PACKAGE_ID" \
        --module marketplace \
        --function fund_kiosk_sonar \
        --args "$MARKETPLACE_ID" "<SONAR_COIN_ID>" \
        --gas-budget "$GAS_BUDGET" \
        --network "$NETWORK"

    success "Kiosk funded with $sonar_amount SONAR"
}

# Set SONAR price override
set_price() {
    local sui_price=$1
    if [ -z "$sui_price" ]; then
        error "Usage: $0 price <sui_amount>"
    fi

    check_config

    local base_units
    base_units=$(to_base_units "$sui_price")

    info "Setting kiosk price override to $sui_price SUI per SONAR ($base_units base units)..."

    sui client call \
        --package "$PACKAGE_ID" \
        --module marketplace \
        --function update_kiosk_price_override \
        --args "$ADMIN_CAP_ID" "$MARKETPLACE_ID" "$base_units" \
        --gas-budget "$GAS_BUDGET" \
        --network "$NETWORK"

    success "Price override set to $sui_price SUI per SONAR"
}

# Clear price override (use dynamic pricing)
clear_price() {
    check_config

    info "Clearing price override (switching to dynamic pricing)..."

    sui client call \
        --package "$PACKAGE_ID" \
        --module marketplace \
        --function update_kiosk_price_override \
        --args "$ADMIN_CAP_ID" "$MARKETPLACE_ID" "0" \
        --gas-budget "$GAS_BUDGET" \
        --network "$NETWORK"

    success "Price override cleared, using dynamic tier pricing"
}

# Update SUI cut percentage
set_sui_cut() {
    local percentage=$1
    if [ -z "$percentage" ]; then
        error "Usage: $0 sui-cut <percentage>"
    fi

    if [ "$percentage" -lt 0 ] || [ "$percentage" -gt 100 ]; then
        error "Percentage must be between 0 and 100"
    fi

    check_config

    info "Setting SUI cut to $percentage%..."

    sui client call \
        --package "$PACKAGE_ID" \
        --module marketplace \
        --function update_kiosk_sui_cut \
        --args "$ADMIN_CAP_ID" "$MARKETPLACE_ID" "$percentage" \
        --gas-budget "$GAS_BUDGET" \
        --network "$NETWORK"

    success "SUI cut set to $percentage%"
}

# Withdraw SUI from kiosk reserve
withdraw_sui() {
    local sui_amount=$1
    if [ -z "$sui_amount" ]; then
        error "Usage: $0 withdraw <sui_amount>"
    fi

    check_config

    local base_units
    base_units=$(to_base_units "$sui_amount")

    warning "Withdrawing $sui_amount SUI from kiosk reserve..."

    sui client call \
        --package "$PACKAGE_ID" \
        --module marketplace \
        --function withdraw_kiosk_sui \
        --args "$ADMIN_CAP_ID" "$MARKETPLACE_ID" "$base_units" \
        --gas-budget "$GAS_BUDGET" \
        --network "$NETWORK"

    success "Withdrawn $sui_amount SUI from kiosk reserve"
}

# Check kiosk status
check_status() {
    check_config

    info "Fetching kiosk status from $NETWORK..."

    # Query the marketplace object to get kiosk state
    sui client object "$MARKETPLACE_ID" --json | jq -r '
        .content.fields.kiosk |
        "SONAR Reserve: " + (.sonar_reserve // "0") + " base units",
        "SUI Reserve: " + (.sui_reserve // "0") + " base units",
        "Base Price: " + (.base_sonar_price // "0") + " base units",
        "Price Override: " + (if .price_override.fields then .price_override.fields.value else "None" end),
        "Current Tier: " + (.current_tier // "?"),
        "SUI Cut: " + (.sui_cut_percentage // "0") + "%",
        "Total SONAR Sold: " + (.total_sonar_sold // "0"),
        "Total Datasets Purchased: " + (.total_datasets_purchased // "0")
    '
}

# Main command routing
main() {
    local command=$1
    shift || true

    case "$command" in
        fund)
            fund_kiosk "$@"
            ;;
        price)
            set_price "$@"
            ;;
        price-clear)
            clear_price
            ;;
        sui-cut)
            set_sui_cut "$@"
            ;;
        withdraw)
            withdraw_sui "$@"
            ;;
        status)
            check_status
            ;;
        help|--help|-h|"")
            cat << EOF
Kiosk Admin Script - Manage SONAR Kiosk Liquidity Pool

Usage: $0 <command> [arguments]

Commands:
    fund <amount>         Fund kiosk with SONAR tokens
    price <sui_amount>    Set SONAR price override (in SUI per SONAR)
    price-clear           Clear price override (use dynamic tier pricing)
    sui-cut <percentage>  Set SUI cut percentage (0-100)
    withdraw <sui_amount> Withdraw SUI from kiosk reserve
    status                Check current kiosk status
    help                  Show this help message

Environment Variables:
    SUI_NETWORK           Network to use (default: testnet)
    SUI_PACKAGE_ID        Package ID of deployed contract
    SUI_MARKETPLACE_ID    Marketplace object ID
    SUI_ADMIN_CAP_ID      AdminCap object ID
    SUI_GAS_BUDGET        Gas budget in base units (default: 100000000)

Examples:
    # Fund kiosk with 10,000 SONAR
    $0 fund 10000

    # Set price to 0.8 SUI per SONAR
    $0 price 0.8

    # Set SUI cut to 30%
    $0 sui-cut 30

    # Check kiosk status
    $0 status
EOF
            ;;
        *)
            error "Unknown command: $command\nRun '$0 help' for usage information"
            ;;
    esac
}

main "$@"
