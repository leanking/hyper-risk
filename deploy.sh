#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== HyperLiquid Risk Dashboard Deployment ===${NC}"
echo -e "${YELLOW}This script will help you deploy your application to Render using Docker.${NC}"
echo

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: git is not installed. Please install git and try again.${NC}"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
    echo -e "${RED}Error: Not in a git repository. Please run this script from your project directory.${NC}"
    exit 1
fi

# Check for Cargo.lock file and warn about potential issues
if [ -f "Cargo.lock" ]; then
    echo -e "${YELLOW}Cargo.lock file detected. This may cause issues during Docker build if it was created with a different version of Rust.${NC}"
    echo -e "${YELLOW}The project requires Rust 1.81 or newer due to dependency requirements.${NC}"
    echo -e "Would you like to remove the Cargo.lock file to avoid potential version issues? (y/n)"
    read -r remove_cargo_lock
    if [[ "$remove_cargo_lock" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo -e "${YELLOW}Removing Cargo.lock file...${NC}"
        rm -f Cargo.lock
        echo -e "${GREEN}Cargo.lock file removed. A new one will be generated during the Docker build.${NC}"
    else
        echo -e "${YELLOW}Keeping Cargo.lock file. If you encounter version issues during deployment, try running ./test_docker_fix.sh${NC}"
    fi
fi

# Test Docker configuration locally first
echo -e "${YELLOW}Would you like to test the Docker configuration locally first? (y/n)${NC}"
read -r test_locally
if [[ "$test_locally" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo -e "${YELLOW}Testing Docker configuration locally...${NC}"
    chmod +x docker_debug.sh
    ./docker_debug.sh
    
    echo -e "${YELLOW}Did the local test work correctly? (y/n)${NC}"
    read -r test_success
    if [[ ! "$test_success" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo -e "${RED}Please fix any issues with the Docker configuration before deploying to Render.${NC}"
        echo -e "${YELLOW}If you encountered a Cargo.lock version error, try running ./test_docker_fix.sh${NC}"
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}You have uncommitted changes. It's recommended to commit these changes before proceeding.${NC}"
    echo -e "Would you like to commit these changes? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo -e "Enter a commit message:"
        read -r commit_message
        git add .
        git commit -m "$commit_message"
        echo -e "${GREEN}Changes committed.${NC}"
    else
        echo -e "${YELLOW}Proceeding without committing changes.${NC}"
    fi
fi

# Push changes to the repository
echo -e "${YELLOW}Would you like to push changes to the repository? (y/n)${NC}"
read -r push_changes
if [[ "$push_changes" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo -e "${YELLOW}Pushing changes to the repository...${NC}"
    git push
    echo -e "${GREEN}Changes pushed to the repository.${NC}"
else
    echo -e "${YELLOW}Skipping push to repository.${NC}"
fi

echo
echo -e "${YELLOW}Next steps for Docker deployment on Render:${NC}"
echo
echo -e "1. Go to your Render dashboard: https://dashboard.render.com/"
echo -e "2. Click 'New' and select 'Blueprint'"
echo -e "3. Connect to your GitHub repository if not already connected"
echo -e "4. Select your repository"
echo -e "5. Render will detect your render.docker.yaml file and set up the service"
echo -e "6. Follow the prompts to complete the deployment"
echo -e "   - You'll be asked to provide values for any environment variables marked with 'sync: false'"
echo -e "   - Make sure to enter your WALLET_ADDRESS when prompted"
echo
echo -e "7. Wait for the deployment to complete (this may take 5-10 minutes)"
echo
echo -e "${YELLOW}After deployment:${NC}"
echo -e "1. Check the Render logs for any errors"
echo -e "2. Run the test script to check if your API endpoints are accessible:"
echo -e "   ${GREEN}./test_api.sh https://hyper-risk.onrender.com${NC}"
echo -e "   (Replace with your actual Render URL)"
echo
echo -e "${YELLOW}If you encounter any issues, refer to the render_deployment_guide.md file for troubleshooting tips.${NC}"
echo
echo -e "${GREEN}Done!${NC}" 