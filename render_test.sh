#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== HyperLiquid Risk Dashboard Render Test ===${NC}"
echo -e "${YELLOW}This script will test the fixed build for Render deployment.${NC}"
echo

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed. Please install Docker and try again.${NC}"
    exit 1
fi

# Build the Docker image with verbose output
echo -e "${YELLOW}Building Docker image with fixed dependencies...${NC}"
echo -e "${YELLOW}This may take several minutes. Please be patient.${NC}"
docker build -t hyperliquid-risk-dashboard-render -f Dockerfile.render . --progress=plain

# Check if the build was successful
BUILD_STATUS=$?
if [ $BUILD_STATUS -eq 0 ]; then
    echo -e "${GREEN}Docker build successful!${NC}"
    echo -e "The fixes for the dependency issues worked."
    
    # Verify the image exists
    if docker images | grep -q "hyperliquid-risk-dashboard-render"; then
        echo -e "${GREEN}Image verified: hyperliquid-risk-dashboard-render${NC}"
        
        echo
        echo -e "${YELLOW}Would you like to run the container to test it? (y/n)${NC}"
        read -r run_container
        if [[ "$run_container" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            echo -e "${YELLOW}Running container...${NC}"
            echo -e "The container will be accessible at http://localhost:8080"
            echo -e "Press Ctrl+C to stop the container."
            echo
            
            # Prompt for wallet address if not in environment
            if [ -z "$WALLET_ADDRESS" ]; then
                echo -e "${YELLOW}Enter your HyperLiquid wallet address (or press Enter to skip):${NC}"
                read -r wallet_address
                
                if [ -n "$wallet_address" ]; then
                    docker run --rm -p 8080:8080 -e PORT=8080 -e DASHBOARD_PORT=8080 -e WALLET_ADDRESS="$wallet_address" -e RENDER=true hyperliquid-risk-dashboard-render
                else
                    echo -e "${RED}WALLET_ADDRESS is required to run the container.${NC}"
                    echo -e "Please set the WALLET_ADDRESS environment variable or provide it when prompted."
                    exit 1
                fi
            else
                docker run --rm -p 8080:8080 -e PORT=8080 -e DASHBOARD_PORT=8080 -e WALLET_ADDRESS="$WALLET_ADDRESS" -e RENDER=true hyperliquid-risk-dashboard-render
            fi
        else
            echo -e "${YELLOW}Skipping container run.${NC}"
        fi
    else
        echo -e "${RED}Error: Docker image 'hyperliquid-risk-dashboard-render' not found despite successful build.${NC}"
        echo -e "This is unusual. Let's try listing all images:"
        docker images
        exit 1
    fi
else
    echo -e "${RED}Docker build failed with exit code: $BUILD_STATUS${NC}"
    echo -e "Please check the error messages above for details."
    exit 1
fi

echo
echo -e "${GREEN}Next steps for Render deployment:${NC}"
echo -e "1. Push your changes to your repository"
echo -e "2. Deploy to Render using the render.docker.yaml configuration"
echo -e "3. Monitor the build logs on Render for any issues"
echo
echo -e "${GREEN}Done!${NC}" 