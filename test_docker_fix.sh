#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Testing Docker Build with Fixed Dockerfile ===${NC}"
echo -e "${YELLOW}This script will test the Docker build with the fixed Dockerfile.${NC}"
echo -e "${YELLOW}The project requires Rust 1.81 or newer due to dependency requirements.${NC}"
echo

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed. Please install Docker and try again.${NC}"
    exit 1
fi

# Build the Docker image with verbose output
echo -e "${YELLOW}Building Docker image with fixed Dockerfile...${NC}"
echo -e "${YELLOW}This may take several minutes. Please be patient.${NC}"
docker build -t hyperliquid-risk-dashboard-test -f Dockerfile.render . --progress=plain

# Check if the build was successful
BUILD_STATUS=$?
if [ $BUILD_STATUS -eq 0 ]; then
    echo -e "${GREEN}Docker build successful!${NC}"
    echo -e "The fix for the Cargo.lock version issue worked."
    
    # Verify the image exists
    if docker images | grep -q "hyperliquid-risk-dashboard-test"; then
        echo -e "${GREEN}Image verified: hyperliquid-risk-dashboard-test${NC}"
        
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
                    docker run --rm -p 8080:8080 -e PORT=8080 -e DASHBOARD_PORT=8080 -e WALLET_ADDRESS="$wallet_address" -e RENDER=true hyperliquid-risk-dashboard-test
                else
                    docker run --rm -p 8080:8080 -e PORT=8080 -e DASHBOARD_PORT=8080 -e RENDER=true hyperliquid-risk-dashboard-test
                fi
            else
                docker run --rm -p 8080:8080 -e PORT=8080 -e DASHBOARD_PORT=8080 -e WALLET_ADDRESS="$WALLET_ADDRESS" -e RENDER=true hyperliquid-risk-dashboard-test
            fi
        else
            echo -e "${YELLOW}Skipping container run.${NC}"
        fi
    else
        echo -e "${RED}Error: Docker image 'hyperliquid-risk-dashboard-test' not found despite successful build.${NC}"
        echo -e "This is unusual. Let's try listing all images:"
        docker images
        exit 1
    fi
else
    echo -e "${RED}Docker build failed with exit code: $BUILD_STATUS${NC}"
    echo -e "Please check the error messages above for details."
    
    # Check for specific errors
    if docker logs $(docker ps -lq) 2>&1 | grep -q "lock file version"; then
        echo -e "${RED}Cargo.lock version error detected.${NC}"
        echo -e "The current fix didn't work. Let's try a more aggressive approach:"
        echo -e "1. Make sure you're using the latest Dockerfile.render with Rust 1.81"
        echo -e "2. Try manually removing the Cargo.lock file from your project:"
        echo -e "   ${YELLOW}rm Cargo.lock${NC}"
        echo -e "3. Run this test script again"
    elif docker logs $(docker ps -lq) 2>&1 | grep -q "requires rustc"; then
        echo -e "${RED}Rust version requirement error detected.${NC}"
        echo -e "Some dependencies require a newer version of Rust than what's in the Dockerfile."
        echo -e "The Dockerfile has been updated to use Rust 1.81, which should satisfy all dependencies."
        echo -e "If you're still seeing this error, check if any dependencies require an even newer version."
    elif docker logs $(docker ps -lq) 2>&1 | grep -q "could not determine which binary to run"; then
        echo -e "${RED}Binary selection error detected.${NC}"
        echo -e "The Docker container doesn't know which binary to run because the project has multiple binaries."
        echo -e "To fix this, update your Dockerfile.render to explicitly specify the binary:"
        echo -e "${YELLOW}CMD [\"sh\", \"-c\", \"./target/release/risk_dashboard\"]${NC}"
        echo -e "Or add 'default-run = \"risk_dashboard\"' to the [package] section in Cargo.toml."
    fi
    
    exit 1
fi