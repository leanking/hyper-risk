#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== HyperLiquid Risk Dashboard Redeploy Script ===${NC}"
echo -e "${YELLOW}This script will help you redeploy your application to Render with the fixes for the loading loop issue.${NC}"
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
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Go to your Render dashboard: https://dashboard.render.com/"
echo -e "2. Select your HyperLiquid Risk Dashboard service"
echo -e "3. Click on 'Manual Deploy' > 'Clear build cache & deploy'"
echo -e "4. Wait for the deployment to complete (this may take a few minutes)"
echo -e "5. Once deployed, your application should be accessible and no longer stuck in a loading loop"
echo
echo -e "${GREEN}The following fixes were applied:${NC}"
echo -e "1. Changed server binding message from localhost to 0.0.0.0"
echo -e "2. Updated port configuration to use the PORT environment variable set by Render"
echo -e "3. Updated CORS configuration to allow any origin temporarily"
echo -e "4. Updated Content Security Policy to allow connections to any domain temporarily"
echo -e "5. Added a health check endpoint for Render"
echo
echo -e "${YELLOW}After confirming that your application is working correctly, you may want to revert the temporary CORS and CSP changes for better security.${NC}"
echo -e "${GREEN}Done!${NC}" 