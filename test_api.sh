#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if URL was provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: No URL provided.${NC}"
    echo -e "Usage: $0 <base_url>"
    echo -e "Example: $0 https://hyper-risk.onrender.com"
    exit 1
fi

BASE_URL=$1

echo -e "${GREEN}=== HyperLiquid Risk Dashboard API Test ===${NC}"
echo -e "${YELLOW}Testing API endpoints at: ${BASE_URL}${NC}"
echo

# Function to test an endpoint
test_endpoint() {
    local endpoint=$1
    local description=$2
    local url="${BASE_URL}${endpoint}"
    
    echo -e "${YELLOW}Testing: ${description} (${url})${NC}"
    
    # Make the request and capture status code
    status_code=$(curl -s -o /dev/null -w "%{http_code}" "${url}")
    
    if [ "$status_code" -ge 200 ] && [ "$status_code" -lt 300 ]; then
        echo -e "${GREEN}✓ Success (Status: ${status_code})${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed (Status: ${status_code})${NC}"
        return 1
    fi
}

# Test the main endpoints
echo -e "${GREEN}Testing main application endpoints:${NC}"
test_endpoint "/" "Main dashboard page"
test_endpoint "/api/health" "Health check endpoint"
test_endpoint "/api/risk/summary" "Risk summary endpoint"

echo
echo -e "${YELLOW}Testing complete!${NC}"

# Check if the main page is accessible
if curl -s "${BASE_URL}" | grep -q "HyperLiquid Risk Dashboard"; then
    echo -e "${GREEN}✓ Dashboard is accessible and contains expected content${NC}"
else
    echo -e "${RED}✗ Dashboard may be accessible but doesn't contain expected content${NC}"
    echo -e "${YELLOW}This could be normal if your dashboard has a different title or is still loading${NC}"
fi

echo
echo -e "${GREEN}Next steps:${NC}"
echo -e "1. Visit ${BASE_URL} in your browser to verify the dashboard is working"
echo -e "2. Check the logs in Render dashboard if you encounter any issues"
echo -e "3. Make sure your environment variables are set correctly"
echo
echo -e "${GREEN}Done!${NC}" 