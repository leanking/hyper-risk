#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== HyperLiquid Risk Dashboard Codebase Cleanup ===${NC}"
echo -e "${YELLOW}This script will help you clean up redundant files in the codebase.${NC}"
echo

# Create a backup directory
BACKUP_DIR="./backup_$(date +%Y%m%d_%H%M%S)"
echo -e "Creating backup directory: ${BACKUP_DIR}"
mkdir -p "$BACKUP_DIR/src"

# List of redundant files to move to backup
REDUNDANT_FILES=(
  "deploy_docker.sh"
  "deploy_docker_fixed.sh"
  "deploy_blueprint.sh"
  "render.yaml"
  "Dockerfile"
  "deploy.md"
  "redeploy.sh"
)

# Move redundant files to backup directory
for file in "${REDUNDANT_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "Moving $file to backup directory..."
    mv "$file" "$BACKUP_DIR/"
    echo -e "${GREEN}✓${NC} $file moved to backup"
  else
    echo -e "${YELLOW}⚠${NC} $file not found, skipping"
  fi
done

# List of unused source files to move to backup
UNUSED_SRC_FILES=(
  "src/port_config_fix.rs"
  "src/port_config_check.rs"
  "src/health_check.rs"
)

# Move unused source files to backup directory
for file in "${UNUSED_SRC_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "Moving $file to backup directory..."
    # Create the directory structure in the backup
    mkdir -p "$(dirname "$BACKUP_DIR/$file")"
    mv "$file" "$BACKUP_DIR/$file"
    echo -e "${GREEN}✓${NC} $file moved to backup"
  else
    echo -e "${YELLOW}⚠${NC} $file not found, skipping"
  fi
done

# Rename files for clarity
echo -e "\nRenaming files for clarity..."

if [ -f "deploy_render_fixed.sh" ]; then
  echo -e "Renaming deploy_render_fixed.sh to deploy.sh..."
  cp "deploy_render_fixed.sh" "deploy.sh"
  chmod +x "deploy.sh"
  echo -e "${GREEN}✓${NC} Created deploy.sh"
else
  echo -e "${YELLOW}⚠${NC} deploy_render_fixed.sh not found, skipping rename"
fi

# Create a README for the deployment files
echo -e "\nCreating README for deployment files..."
cat > "DEPLOYMENT_README.md" << EOF
# HyperLiquid Risk Dashboard Deployment

This directory contains files for deploying the HyperLiquid Risk Dashboard to Render using Docker.

## Deployment Files

- \`deploy.sh\`: Main deployment script
- \`docker_debug.sh\`: Script for testing Docker configuration locally
- \`Dockerfile.render\`: Docker configuration for Render
- \`render.docker.yaml\`: Render Blueprint configuration
- \`render_deployment_guide.md\`: Comprehensive guide for deploying to Render

## How to Deploy

1. Run \`./deploy.sh\` to deploy to Render
2. Follow the prompts to complete the deployment

For more detailed instructions, see \`render_deployment_guide.md\`.
EOF

echo -e "${GREEN}✓${NC} Created DEPLOYMENT_README.md"

echo -e "\n${GREEN}Codebase cleanup complete!${NC}"
echo -e "Redundant files have been moved to: $BACKUP_DIR"
echo -e "New deployment files have been created for clarity."
echo -e "\nNext steps:"
echo -e "1. Review the changes to ensure everything is correct"
echo -e "2. Run './deploy.sh' to deploy to Render"
echo -e "3. Follow the prompts to complete the deployment"
echo -e "\nFor more detailed instructions, see 'render_deployment_guide.md'." 