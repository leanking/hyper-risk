#!/bin/bash
# Script to check if the HyperLiquid Risk Dashboard is accessible
# Usage: ./check_app_status.sh [render_url] [custom_domain]

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default URLs if not provided
RENDER_URL=${1:-"https://hyper-flow.onrender.com"}
CUSTOM_DOMAIN=${2:-"hyper-flow.xyz"}

echo -e "${YELLOW}Checking HyperLiquid Risk Dashboard Availability${NC}"
echo "=============================================="
echo -e "Render URL: ${YELLOW}$RENDER_URL${NC}"
echo -e "Custom Domain: ${YELLOW}$CUSTOM_DOMAIN${NC}"
echo "=============================================="

# Function to check URL accessibility
check_url() {
    local url=$1
    local description=$2
    
    echo -e "\n${YELLOW}Checking $description ($url)...${NC}"
    
    # Try to get the HTTP status code
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10)
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Could not connect to $url${NC}"
        echo "Possible issues:"
        echo " - The service might be down"
        echo " - Network connectivity issues"
        echo " - DNS resolution problems"
        return 1
    fi
    
    if [ "$HTTP_STATUS" -eq 200 ]; then
        echo -e "${GREEN}Success: $description is accessible (HTTP 200)${NC}"
        return 0
    else
        echo -e "${RED}Warning: $description returned HTTP status $HTTP_STATUS${NC}"
        
        case $HTTP_STATUS in
            301|302|307|308)
                REDIRECT=$(curl -s -I "$url" | grep -i "location:" | awk '{print $2}' | tr -d '\r')
                echo -e "Redirects to: ${YELLOW}$REDIRECT${NC}"
                ;;
            404)
                echo "The page was not found. Check if the application is properly deployed."
                ;;
            500|502|503|504)
                echo "Server error. Check the application logs in Render dashboard."
                ;;
            *)
                echo "Unexpected status code. Check the application logs."
                ;;
        esac
        return 1
    fi
}

# Function to check health endpoint
check_health() {
    local url=$1
    local description=$2
    
    echo -e "\n${YELLOW}Checking health endpoint for $description...${NC}"
    
    # Try to get the HTTP status code for the health endpoint
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$url/health" --max-time 10)
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Could not connect to health endpoint${NC}"
        return 1
    fi
    
    if [ "$HEALTH_STATUS" -eq 200 ]; then
        echo -e "${GREEN}Success: Health check endpoint is responding correctly (HTTP 200)${NC}"
        return 0
    else
        echo -e "${RED}Warning: Health check endpoint returned HTTP status $HEALTH_STATUS${NC}"
        echo "This might be causing Render to restart your service repeatedly."
        return 1
    fi
}

# Function to check DNS resolution
check_dns() {
    local domain=$1
    
    echo -e "\n${YELLOW}Checking DNS resolution for $domain...${NC}"
    
    # Try to resolve the domain
    host $domain > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        IP=$(host $domain | grep "has address" | awk '{print $4}')
        echo -e "${GREEN}Success: Domain resolves to $IP${NC}"
        return 0
    else
        echo -e "${RED}Error: Could not resolve domain $domain${NC}"
        echo "Check your DNS configuration and ensure it's pointing to Render's servers."
        return 1
    fi
}

# Main checks
check_url "$RENDER_URL" "Render URL"
RENDER_STATUS=$?

check_url "https://$CUSTOM_DOMAIN" "Custom Domain"
CUSTOM_STATUS=$?

if [ $CUSTOM_STATUS -ne 0 ]; then
    check_dns "$CUSTOM_DOMAIN"
fi

check_health "$RENDER_URL" "Render URL"
RENDER_HEALTH=$?

if [ $RENDER_STATUS -eq 0 ]; then
    check_health "https://$CUSTOM_DOMAIN" "Custom Domain"
fi

# Summary
echo -e "\n${YELLOW}Summary:${NC}"
echo "=============================================="

if [ $RENDER_STATUS -eq 0 ] && [ $RENDER_HEALTH -eq 0 ]; then
    echo -e "${GREEN}✓ Render URL is working correctly${NC}"
else
    echo -e "${RED}✗ Issues detected with Render URL${NC}"
fi

if [ $CUSTOM_STATUS -eq 0 ]; then
    echo -e "${GREEN}✓ Custom domain is working correctly${NC}"
else
    echo -e "${RED}✗ Issues detected with custom domain${NC}"
fi

echo -e "\n${YELLOW}Next Steps:${NC}"
if [ $RENDER_STATUS -ne 0 ] && [ $CUSTOM_STATUS -ne 0 ]; then
    echo "1. Check the application logs in Render dashboard"
    echo "2. Verify that your application is properly deployed and running"
    echo "3. Consider temporarily disabling the health check in render.yaml"
    echo "4. Try forcing a redeployment with 'Clear build cache & deploy'"
elif [ $RENDER_STATUS -eq 0 ] && [ $CUSTOM_STATUS -ne 0 ]; then
    echo "1. Your application is running on Render but the custom domain has issues"
    echo "2. Verify your DNS configuration in your domain registrar"
    echo "3. Check the custom domain settings in Render dashboard"
    echo "4. Remember that DNS changes can take up to 48 hours to propagate"
fi

echo -e "\nFor more detailed troubleshooting, refer to the 'Application Availability and Loading Issues' section in deploy.md" 