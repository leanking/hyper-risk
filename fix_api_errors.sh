#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== HyperLiquid Risk Dashboard API Error Fixer ===${NC}"
echo -e "${YELLOW}This script will help you fix API errors in your HyperLiquid Risk Dashboard.${NC}"
echo

# Check if we're in the right directory
if [ ! -f "Dockerfile.render" ]; then
    echo -e "${RED}Error: Dockerfile.render not found. Please run this script from the project root directory.${NC}"
    exit 1
fi

# Check if the user has a wallet address
if [ -z "$WALLET_ADDRESS" ]; then
    echo -e "${YELLOW}Please enter your HyperLiquid wallet address:${NC}"
    read -r WALLET_ADDRESS
fi

if [ -z "$WALLET_ADDRESS" ]; then
    echo -e "${RED}Error: No wallet address provided. Cannot continue.${NC}"
    exit 1
fi

echo -e "Using wallet address: ${YELLOW}${WALLET_ADDRESS:0:6}...${WALLET_ADDRESS: -4}${NC}"
echo

# Step 1: Test the HyperLiquid API directly
echo -e "${YELLOW}Step 1: Testing HyperLiquid API connectivity...${NC}"
API_URL=${API_URL:-"https://api.hyperliquid.xyz"}

# Test basic API connectivity - IMPORTANT: HyperLiquid API requires POST requests
echo -e "Testing basic API connectivity..."
INFO_RESPONSE=$(curl -s -X POST "$API_URL/info" -H "Content-Type: application/json" -d "{}")
if [ -z "$INFO_RESPONSE" ]; then
    echo -e "${RED}✗ Cannot connect to API${NC}"
    echo -e "Detailed response:"
    curl -v -X POST "$API_URL/info" -H "Content-Type: application/json" -d "{}" 2>&1
    echo
    echo -e "${RED}API connection failed. Please check your internet connection and API URL.${NC}"
    exit 1
else
    echo -e "${GREEN}✓ API is accessible${NC}"
    echo -e "Response (first 100 chars):"
    echo "$INFO_RESPONSE" | head -c 100
    echo -e "\n${YELLOW}(Response truncated for readability)${NC}"
fi

echo

# Test user-specific API endpoint
echo -e "Testing user-specific API endpoint..."
USER_DATA=$(curl -s -X POST "$API_URL/exchange" -H "Content-Type: application/json" -d "{\"type\":\"clearinghouseState\",\"user\":\"$WALLET_ADDRESS\"}")

if echo "$USER_DATA" | grep -q "error"; then
    echo -e "${RED}✗ Error accessing user data${NC}"
    echo -e "Response:"
    echo "$USER_DATA"
    echo
    echo -e "${RED}User data access failed. Please check your wallet address.${NC}"
    echo -e "This is likely the cause of your API errors in the dashboard."
    echo
    echo -e "${YELLOW}Possible solutions:${NC}"
    echo -e "1. Make sure your wallet address is correct"
    echo -e "2. Try using a different wallet address"
    echo -e "3. Check if your wallet has any activity on HyperLiquid"
    exit 1
else
    echo -e "${GREEN}✓ Successfully accessed user data${NC}"
    echo -e "Response (first 100 chars):"
    echo "$USER_DATA" | head -c 100
    echo -e "\n${YELLOW}(Response truncated for readability)${NC}"
fi

echo

# Test market data API endpoint
echo -e "Testing market data API endpoint..."
MARKET_DATA=$(curl -s -X POST "$API_URL/exchange" -H "Content-Type: application/json" -d "{\"type\":\"allMids\"}")

if [ -z "$MARKET_DATA" ] || echo "$MARKET_DATA" | grep -q "error"; then
    echo -e "${RED}✗ Error accessing market data${NC}"
    echo -e "Response:"
    echo "$MARKET_DATA"
    echo
    echo -e "${RED}Market data access failed.${NC}"
else
    echo -e "${GREEN}✓ Successfully accessed market data${NC}"
    echo -e "Response (first 100 chars):"
    echo "$MARKET_DATA" | head -c 100
    echo -e "\n${YELLOW}(Response truncated for readability)${NC}"
fi

echo

# Step 2: Check environment variables in .env file
echo -e "${YELLOW}Step 2: Checking environment variables...${NC}"

# Create or update .env file
echo -e "Creating/updating .env file with correct environment variables..."
cat > .env << EOF
WALLET_ADDRESS=$WALLET_ADDRESS
PORT=8080
DASHBOARD_PORT=8080
RUST_LOG=info
RENDER=true
API_URL=$API_URL
EOF

echo -e "${GREEN}✓ Created/updated .env file with correct environment variables${NC}"
echo

# Step 3: Update the Dockerfile
echo -e "${YELLOW}Step 3: Checking Dockerfile.render...${NC}"

if grep -q "jq" Dockerfile.render; then
    echo -e "${GREEN}✓ Dockerfile.render already has jq installed${NC}"
else
    echo -e "${YELLOW}Dockerfile.render needs to be updated to include jq. Would you like to update it now? (y/n)${NC}"
    read -r update_dockerfile
    if [[ "$update_dockerfile" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo -e "Backing up original Dockerfile.render to Dockerfile.render.bak..."
        cp Dockerfile.render Dockerfile.render.bak
        
        # Update the Dockerfile
        sed -i.bak 's/RUN apt-get update && apt-get install -y pkg-config libssl-dev ca-certificates curl/RUN apt-get update \&\& apt-get install -y pkg-config libssl-dev ca-certificates curl jq/' Dockerfile.render
        
        echo -e "${GREEN}✓ Updated Dockerfile.render${NC}"
    else
        echo -e "${YELLOW}Skipping Dockerfile update.${NC}"
    fi
fi

# Update the startup script in Dockerfile.render to use POST for API info
if grep -q "curl -s \"$API_URL/info\"" Dockerfile.render; then
    echo -e "${YELLOW}Dockerfile.render needs to be updated to use POST for API requests. Would you like to update it now? (y/n)${NC}"
    read -r update_api_calls
    if [[ "$update_api_calls" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo -e "Backing up original Dockerfile.render to Dockerfile.render.bak2..."
        cp Dockerfile.render Dockerfile.render.bak2
        
        # Update the API calls in the Dockerfile
        sed -i.bak 'INFO_RESPONSE=$(curl -s "$API_URL/info")/INFO_RESPONSE=$(curl -s -X POST "$API_URL/info" -H "Content-Type: application/json" -d "{}")/' Dockerfile.render
        
        echo -e "${GREEN}✓ Updated API calls in Dockerfile.render${NC}"
    else
        echo -e "${YELLOW}Skipping API call updates.${NC}"
    fi
fi

echo

# Step 4: Test the application locally
echo -e "${YELLOW}Step 4: Would you like to test the application locally? (y/n)${NC}"
read -r test_locally
if [[ "$test_locally" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo -e "Testing the application locally..."
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed. Please install Docker and try again.${NC}"
        exit 1
    fi
    
    echo -e "Building Docker image..."
    docker build -t hyperliquid-risk-dashboard-test -f Dockerfile.render .
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to build Docker image. See above for details.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Docker image built successfully.${NC}"
    echo -e "Running Docker container..."
    echo -e "The container will be accessible at http://localhost:8080"
    echo -e "Press Ctrl+C to stop the container."
    echo
    
    docker run --rm -p 8080:8080 -e PORT=8080 -e DASHBOARD_PORT=8080 -e WALLET_ADDRESS="$WALLET_ADDRESS" -e RENDER=true hyperliquid-risk-dashboard-test
else
    echo -e "${YELLOW}Skipping local testing.${NC}"
fi

echo

# Step 5: Provide instructions for deployment
echo -e "${YELLOW}Step 5: Deployment instructions${NC}"
echo -e "To deploy your application to Render:"
echo -e "1. Commit and push your changes to your repository"
echo -e "2. Go to your Render dashboard: https://dashboard.render.com/"
echo -e "3. Select your service"
echo -e "4. Click on 'Environment' in the left sidebar"
echo -e "5. Make sure the following environment variables are set:"
echo -e "   - WALLET_ADDRESS: $WALLET_ADDRESS"
echo -e "   - PORT: 8080"
echo -e "   - DASHBOARD_PORT: 8080"
echo -e "   - RUST_LOG: info"
echo -e "   - RENDER: true"
echo -e "6. Click 'Save Changes'"
echo -e "7. Click 'Manual Deploy' > 'Deploy latest commit'"
echo

echo -e "${GREEN}Done!${NC}"
echo -e "If you still encounter issues, please refer to the API_RESPONSE_FIX.md file for more detailed troubleshooting steps." 