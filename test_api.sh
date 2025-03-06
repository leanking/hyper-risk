#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the Render URL from command line or use default
RENDER_URL=${1:-"https://hyper-risk.onrender.com"}

echo -e "${YELLOW}Testing API endpoints for ${RENDER_URL}${NC}"
echo "=============================================="

# Function to test an endpoint
test_endpoint() {
    local endpoint=$1
    local url="${RENDER_URL}${endpoint}"
    
    echo -e "\n${YELLOW}Testing: ${url}${NC}"
    
    # Make the request and capture status code
    status_code=$(curl -s -o /dev/null -w "%{http_code}" "${url}")
    
    if [ "$status_code" -eq 200 ]; then
        echo -e "${GREEN}SUCCESS: Status code 200${NC}"
        # Show the response (limited to 500 characters)
        echo "Response preview:"
        curl -s "${url}" | head -c 500
        echo -e "\n..."
    else
        echo -e "${RED}FAILED: Status code ${status_code}${NC}"
    fi
}

# Test health endpoint
test_endpoint "/health"

# Test API endpoints
test_endpoint "/api/risk_summary"
test_endpoint "/api/risk_analysis"
test_endpoint "/api/positions"

echo -e "\n${YELLOW}Testing complete.${NC}"
echo "If any endpoints failed, check your server logs for errors."
echo "If all endpoints succeeded but the dashboard is still loading, check your browser console for JavaScript errors." 