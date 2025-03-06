#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== HyperLiquid Risk Dashboard Response Checker ===${NC}"
echo -e "${YELLOW}This script will check if your application is responding to requests.${NC}"
echo

# Get the URL from the command line or use default
URL=${1:-"http://localhost:8080"}
# Remove trailing slash if present to prevent double slashes
URL=${URL%/}

echo -e "Checking application at: ${YELLOW}$URL${NC}"
echo

# Check health endpoint
echo -e "${YELLOW}Checking health endpoint...${NC}"
if curl -s -o /dev/null -w "%{http_code}" "$URL/health" | grep -q "200"; then
    echo -e "${GREEN}✓ Health endpoint is responding (200 OK)${NC}"
else
    echo -e "${RED}✗ Health endpoint is not responding correctly${NC}"
    echo -e "Detailed response:"
    curl -v "$URL/health" 2>&1
    echo
fi

echo

# Check static files
echo -e "${YELLOW}Checking static files...${NC}"
if curl -s -o /dev/null -w "%{http_code}" "$URL" | grep -q "200"; then
    echo -e "${GREEN}✓ Static files are being served (200 OK)${NC}"
else
    echo -e "${RED}✗ Static files are not being served correctly${NC}"
    echo -e "Detailed response:"
    curl -v "$URL" 2>&1
    echo
fi

echo

# Check API endpoint
echo -e "${YELLOW}Checking API endpoint...${NC}"
if curl -s -o /dev/null -w "%{http_code}" "$URL/api/risk_summary" | grep -q "200"; then
    echo -e "${GREEN}✓ API endpoint is responding (200 OK)${NC}"
else
    echo -e "${RED}✗ API endpoint is not responding correctly${NC}"
    echo -e "Detailed response:"
    curl -v "$URL/api/risk_summary" 2>&1
    echo
fi

echo
echo -e "${YELLOW}Troubleshooting tips:${NC}"
echo -e "1. Make sure your application is binding to 0.0.0.0 (all interfaces)"
echo -e "2. Verify that the PORT environment variable is set correctly"
echo -e "3. Check if the static files directory exists and has correct permissions"
echo -e "4. Look for any error messages in the application logs"
echo -e "5. For more detailed troubleshooting, see RENDER_DEPLOYMENT_DEBUG.md"
echo

echo -e "${GREEN}Done!${NC}" 