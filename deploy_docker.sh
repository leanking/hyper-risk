#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== HyperLiquid Risk Dashboard Docker Deployment ===${NC}"
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
echo -e "${YELLOW}Pushing changes to the repository...${NC}"
git push

echo -e "${GREEN}Changes pushed to the repository.${NC}"
echo
echo -e "${YELLOW}Next steps for Docker deployment on Render:${NC}"
echo
echo -e "1. Go to your Render dashboard: https://dashboard.render.com/"
echo -e "2. Click 'New' and select 'Web Service'"
echo -e "3. Connect to your GitHub repository if not already connected"
echo -e "4. Select your repository"
echo -e "5. Configure the service with these settings:"
echo -e "   - Name: hyperliquid-risk-dashboard (or your preferred name)"
echo -e "   - Region: Choose a region close to you"
echo -e "   - Branch: main (or your preferred branch)"
echo -e "   - Runtime: Docker"
echo -e "   - Docker Command: Leave empty (will use CMD from Dockerfile)"
echo -e "   - Instance Type: Starter (or higher)"
echo
echo -e "6. Click 'Advanced' and add these environment variables:"
echo -e "   - WALLET_ADDRESS: Your HyperLiquid wallet address"
echo -e "   (Add any other variables you need)"
echo
echo -e "7. Click 'Create Web Service'"
echo -e "8. Wait for the deployment to complete (this may take 5-10 minutes)"
echo
echo -e "${YELLOW}Alternative Blueprint Deployment:${NC}"
echo -e "1. Go to your Render dashboard"
echo -e "2. Click 'New' and select 'Blueprint'"
echo -e "3. Connect to your GitHub repository"
echo -e "4. Render will detect your render.docker.yaml file and set up the service"
echo -e "5. Follow the prompts to complete the deployment"
echo
echo -e "${YELLOW}After deployment:${NC}"
echo -e "1. Run the test script to check if your API endpoints are accessible:"
echo -e "   ${GREEN}./test_api.sh https://your-service-name.onrender.com${NC}"
echo
echo -e "${GREEN}Done!${NC}" 