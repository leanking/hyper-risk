#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== HyperLiquid API Tester ===${NC}"
echo -e "${YELLOW}This script will test your connection to the HyperLiquid API.${NC}"
echo

# Get the wallet address from the command line or environment variable
WALLET_ADDRESS=${1:-$WALLET_ADDRESS}

if [ -z "$WALLET_ADDRESS" ]; then
    echo -e "${YELLOW}Please enter your HyperLiquid wallet address:${NC}"
    read -r WALLET_ADDRESS
fi

if [ -z "$WALLET_ADDRESS" ]; then
    echo -e "${RED}Error: No wallet address provided. Cannot continue.${NC}"
    exit 1
fi

# Get the API URL from environment variable or use default
API_URL=${API_URL:-"https://api.hyperliquid.xyz"}

echo -e "Testing HyperLiquid API with:"
echo -e "API URL: ${YELLOW}$API_URL${NC}"
echo -e "Wallet Address: ${YELLOW}${WALLET_ADDRESS:0:6}...${WALLET_ADDRESS: -4}${NC}"
echo

# Test basic API connectivity
echo -e "${YELLOW}Testing basic API connectivity...${NC}"
if curl -s -o /dev/null -w "%{http_code}" "$API_URL/info" | grep -q "200"; then
    echo -e "${GREEN}✓ API is accessible (200 OK)${NC}"
    echo -e "Response:"
    curl -s "$API_URL/info" | head -20
    echo -e "\n${YELLOW}(Response truncated for readability)${NC}"
else
    echo -e "${RED}✗ Cannot connect to API${NC}"
    echo -e "Detailed response:"
    curl -v "$API_URL/info" 2>&1
    echo
    echo -e "${RED}API connection failed. Please check your internet connection and API URL.${NC}"
    exit 1
fi

echo

# Test user-specific API endpoint
echo -e "${YELLOW}Testing user-specific API endpoint...${NC}"
USER_DATA=$(curl -s -X POST "$API_URL/exchange" -H "Content-Type: application/json" -d "{\"type\":\"clearinghouseState\",\"user\":\"$WALLET_ADDRESS\"}")

if echo "$USER_DATA" | grep -q "error"; then
    echo -e "${RED}✗ Error accessing user data${NC}"
    echo -e "Response:"
    echo "$USER_DATA"
    echo
    echo -e "${RED}User data access failed. Please check your wallet address.${NC}"
else
    echo -e "${GREEN}✓ Successfully accessed user data${NC}"
    echo -e "Response (truncated):"
    echo "$USER_DATA" | head -20
    echo -e "\n${YELLOW}(Response truncated for readability)${NC}"
fi

echo

# Test market data API endpoint
echo -e "${YELLOW}Testing market data API endpoint...${NC}"
MARKET_DATA=$(curl -s -X POST "$API_URL/exchange" -H "Content-Type: application/json" -d "{\"type\":\"allMids\"}")

if [ -z "$MARKET_DATA" ] || echo "$MARKET_DATA" | grep -q "error"; then
    echo -e "${RED}✗ Error accessing market data${NC}"
    echo -e "Response:"
    echo "$MARKET_DATA"
    echo
    echo -e "${RED}Market data access failed.${NC}"
else
    echo -e "${GREEN}✓ Successfully accessed market data${NC}"
    echo -e "Response (truncated):"
    echo "$MARKET_DATA" | head -20
    echo -e "\n${YELLOW}(Response truncated for readability)${NC}"
fi

echo
echo -e "${YELLOW}API Test Summary:${NC}"
echo -e "1. Basic API connectivity: $(if curl -s -o /dev/null -w "%{http_code}" "$API_URL/info" | grep -q "200"; then echo -e "${GREEN}PASS${NC}"; else echo -e "${RED}FAIL${NC}"; fi)"
echo -e "2. User-specific data access: $(if ! echo "$USER_DATA" | grep -q "error"; then echo -e "${GREEN}PASS${NC}"; else echo -e "${RED}FAIL${NC}"; fi)"
echo -e "3. Market data access: $(if [ -n "$MARKET_DATA" ] && ! echo "$MARKET_DATA" | grep -q "error"; then echo -e "${GREEN}PASS${NC}"; else echo -e "${RED}FAIL${NC}"; fi)"
echo

echo -e "${YELLOW}Troubleshooting tips:${NC}"
echo -e "1. Make sure your wallet address is correct"
echo -e "2. Verify that the API URL is accessible from your network"
echo -e "3. Check if your wallet has the necessary permissions"
echo -e "4. Try using a different wallet address if available"
echo -e "5. For more detailed troubleshooting, see API_RESPONSE_FIX.md"
echo

echo -e "${GREEN}Done!${NC}" 