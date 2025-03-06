#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== HyperLiquid Risk Dashboard Docker Deployment Debugger ===${NC}"
echo -e "${YELLOW}This script will help you debug Docker deployment issues.${NC}"
echo

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed. Please install Docker and try again.${NC}"
    exit 1
fi

# Build the Docker image locally
echo -e "${YELLOW}Building Docker image locally...${NC}"
docker build -t hyperliquid-risk-dashboard -f Dockerfile.render .

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to build Docker image. See above for details.${NC}"
    exit 1
fi

echo -e "${GREEN}Docker image built successfully.${NC}"

# Run the Docker container locally
echo -e "${YELLOW}Running Docker container locally...${NC}"
echo -e "This will run the container with the PORT environment variable set to 8080."
echo -e "The container will be accessible at http://localhost:8080"
echo -e "Press Ctrl+C to stop the container."
echo

# Run with environment variables from .env if it exists
if [ -f .env ]; then
    echo -e "${YELLOW}Using environment variables from .env file...${NC}"
    docker run --rm -p 8080:8080 --env-file .env -e PORT=8080 -e DASHBOARD_PORT=8080 -e RENDER=true hyperliquid-risk-dashboard
else
    echo -e "${YELLOW}No .env file found. Running with default environment variables...${NC}"
    echo -e "${YELLOW}You may need to set the WALLET_ADDRESS environment variable.${NC}"
    
    # Prompt for wallet address if not in environment
    if [ -z "$WALLET_ADDRESS" ]; then
        echo -e "${YELLOW}Enter your HyperLiquid wallet address (or press Enter to skip):${NC}"
        read -r wallet_address
        
        if [ -n "$wallet_address" ]; then
            docker run --rm -p 8080:8080 -e PORT=8080 -e DASHBOARD_PORT=8080 -e WALLET_ADDRESS="$wallet_address" -e RENDER=true hyperliquid-risk-dashboard
        else
            docker run --rm -p 8080:8080 -e PORT=8080 -e DASHBOARD_PORT=8080 -e RENDER=true hyperliquid-risk-dashboard
        fi
    else
        docker run --rm -p 8080:8080 -e PORT=8080 -e DASHBOARD_PORT=8080 -e WALLET_ADDRESS="$WALLET_ADDRESS" -e RENDER=true hyperliquid-risk-dashboard
    fi
fi 