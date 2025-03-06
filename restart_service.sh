#!/bin/bash
# Script to diagnose and restart a Render service that's showing as Live but not responding
# This script uses the Render API to restart your service without rebuilding

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RENDER_URL=${1:-"https://hyper-flow.onrender.com"}
CUSTOM_DOMAIN=${2:-"hyper-flow.xyz"}

echo -e "${YELLOW}HyperLiquid Risk Dashboard Service Diagnostics${NC}"
echo "=============================================="
echo -e "Render URL: ${BLUE}$RENDER_URL${NC}"
echo -e "Custom Domain: ${BLUE}$CUSTOM_DOMAIN${NC}"
echo "=============================================="

# Check if the service is responding
echo -e "\n${YELLOW}Checking if service is responding...${NC}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$RENDER_URL" --max-time 10)

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Could not connect to $RENDER_URL${NC}"
    echo "The service is not responding to requests."
else
    if [ "$HTTP_STATUS" -eq 200 ]; then
        echo -e "${GREEN}Service is responding with HTTP 200 OK${NC}"
        echo "If you're still experiencing issues, check for partial functionality."
        exit 0
    else
        echo -e "${RED}Service is responding with HTTP status $HTTP_STATUS${NC}"
    fi
fi

# Diagnostic information
echo -e "\n${YELLOW}Collecting diagnostic information...${NC}"

# Check memory usage (this requires manual inspection in Render dashboard)
echo -e "${BLUE}Memory Usage:${NC} Check the memory graph in Render dashboard"
echo "If memory usage is consistently high or growing, you may have a memory leak."

# Check for port configuration
echo -e "\n${BLUE}Port Configuration:${NC}"
echo "Ensure your application is listening on the PORT environment variable set by Render."
echo "Add this code to your application if not already present:"
echo -e "${GREEN}let port = std::env::var(\"PORT\").unwrap_or_else(|_| \"8080\".to_string());${NC}"

# Check for deadlocks
echo -e "\n${BLUE}Potential Deadlocks:${NC}"
echo "Look for these patterns in your code:"
echo "1. Mutexes or locks that might not be released"
echo "2. Waiting for resources that might never become available"
echo "3. Infinite loops or recursion without proper exit conditions"
echo "4. Thread pool exhaustion"

# Check for connection issues
echo -e "\n${BLUE}Connection Issues:${NC}"
echo "If you're connecting to external services (databases, APIs):"
echo "1. Ensure connections are properly closed after use"
echo "2. Implement timeouts for all external calls"
echo "3. Add retry logic with backoff for transient failures"

# Restart options
echo -e "\n${YELLOW}Restart Options:${NC}"
echo "1. Soft Restart: Deploy the latest commit without rebuilding"
echo "   - This is faster but won't fix issues with the build"
echo "2. Hard Restart: Clear build cache and deploy"
echo "   - This takes longer but ensures a fresh build"
echo "3. Rollback: Revert to a previous working deployment"
echo "   - Use this if a recent change caused the issue"

# Manual steps to restart
echo -e "\n${YELLOW}Manual Steps to Restart:${NC}"
echo "1. Go to your Render dashboard: https://dashboard.render.com"
echo "2. Select your service: hyperliquid-risk-dashboard"
echo "3. Click 'Manual Deploy'"
echo "4. Choose 'Deploy latest commit' for a soft restart"
echo "   or 'Clear build cache & deploy' for a hard restart"

# Monitoring after restart
echo -e "\n${YELLOW}After Restarting:${NC}"
echo "1. Monitor the logs for any errors during startup"
echo "2. Check if the service becomes responsive"
echo "3. Look for any patterns in resource usage (CPU, memory)"

# Implement better logging
echo -e "\n${YELLOW}Improving Monitoring:${NC}"
echo "Consider adding these logging improvements to your application:"
echo "1. Periodic heartbeat logs (every 5-10 minutes)"
echo "2. Startup completion logs"
echo "3. Request/response logging for debugging"
echo "4. Resource usage logging (memory, connections)"

echo -e "\n${GREEN}For more detailed troubleshooting, refer to the 'Service Shows as Live but Not Responding' section in deploy.md${NC}" 