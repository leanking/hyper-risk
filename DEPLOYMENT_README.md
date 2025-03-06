# HyperLiquid Risk Dashboard Deployment

This directory contains files for deploying the HyperLiquid Risk Dashboard to Render using Docker.

## Deployment Files

- `deploy.sh`: Main deployment script
- `docker_debug.sh`: Script for testing Docker configuration locally
- `test_docker_fix.sh`: Script for testing the Cargo.lock version fix
- `Dockerfile.render`: Docker configuration for Render
- `render.docker.yaml`: Render Blueprint configuration
- `render_deployment_guide.md`: Comprehensive guide for deploying to Render
- `CARGO_LOCK_FIX.md`: Documentation about the Cargo.lock version fix

## How to Deploy

1. Run `./deploy.sh` to deploy to Render
2. Follow the prompts to complete the deployment

## Troubleshooting

If you encounter a Cargo.lock version error during deployment, see `CARGO_LOCK_FIX.md` for details on the fix.

For more detailed instructions, see `render_deployment_guide.md`.
