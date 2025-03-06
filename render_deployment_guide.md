# HyperLiquid Risk Dashboard Render Deployment Guide

This guide will help you deploy the HyperLiquid Risk Dashboard to Render using Docker.

## Prerequisites

- A GitHub account
- Your HyperLiquid wallet address
- A Render account (free tier is sufficient)

## Deployment Steps

### 1. Prepare Your Repository

1. Make sure your code is pushed to a GitHub repository
2. Ensure you have the following files in your repository:
   - `Dockerfile.render` - The Docker configuration for Render
   - `render.docker.yaml` - The Render Blueprint configuration

### 2. Test Locally (Optional but Recommended)

Before deploying to Render, you can test your Docker configuration locally:

```bash
# Make the debug script executable
chmod +x docker_debug.sh

# Run the debug script
./docker_debug.sh
```

This will build and run your Docker container locally. If it works correctly, you should be able to access the dashboard at http://localhost:8080.

### 3. Deploy to Render

#### Option 1: Manual Deployment

1. Go to your Render dashboard: https://dashboard.render.com/
2. Click "New" and select "Web Service"
3. Connect to your GitHub repository if not already connected
4. Select your repository
5. Configure the service with these settings:
   - Name: hyper-risk (or your preferred name)
   - Region: Choose a region close to you
   - Branch: main (or your preferred branch)
   - Runtime: Docker
   - Docker Command: Leave empty (will use CMD from Dockerfile)
   - Instance Type: Free (or higher)
6. Click "Advanced" and add these environment variables:
   - `PORT`: 8080
   - `DASHBOARD_PORT`: 8080
   - `WALLET_ADDRESS`: Your HyperLiquid wallet address
   - `RENDER`: true
7. Click "Create Web Service"

#### Option 2: Blueprint Deployment (Recommended)

1. Go to your Render dashboard: https://dashboard.render.com/
2. Click "New" and select "Blueprint"
3. Connect to your GitHub repository
4. Render will detect your `render.docker.yaml` file and set up the service
5. Follow the prompts to complete the deployment
   - You'll be asked to provide values for any environment variables marked with `sync: false`
   - Make sure to enter your `WALLET_ADDRESS` when prompted

### 4. Verify Deployment

1. Wait for the deployment to complete (this may take 5-10 minutes)
2. Once deployed, click on the service URL to access your dashboard
3. You can also run the test script to check if your API endpoints are accessible:
   ```bash
   ./test_api.sh https://hyper-risk.onrender.com
   ```
   (Replace with your actual Render URL)

## Troubleshooting

### Common Issues

1. **Cargo.lock Version Error and Rust Version Requirements**
   - If you see an error like `lock file version 4 was found, but this version of Cargo does not understand this lock file`, it means your Cargo.lock was created with a newer version of Rust than what's in the Docker image.
   - You may also see errors like `package 'parity-scale-codec v3.7.4' cannot be built because it requires rustc 1.79.0 or newer` or `litemap@0.7.5 requires rustc 1.81`.
   - Solution: 
     - The Dockerfile.render has been updated to use Rust 1.81 and regenerate the lock file during the build process.
     - If you still encounter this issue, try these steps:
       1. Remove the Cargo.lock file from your project: `rm Cargo.lock`
       2. Run the test script: `./test_docker_fix.sh`
       3. If successful, commit and push the changes without the Cargo.lock file

2. **Binary selection error during deployment**
   - If you see an error like `cargo run could not determine which binary to run. Use the --bin option to specify a binary`, it means Render doesn't know which binary to execute.
   - This happens because the project contains multiple binaries.
   - Solution:
     - Make sure your Dockerfile.render explicitly specifies the binary to run:
       ```
       CMD ["sh", "-c", "./target/release/risk_dashboard"]
       ```
     - Alternatively, you can modify the CMD to use the --bin option:
       ```
       CMD ["sh", "-c", "cargo run --release --bin risk_dashboard"]
       ```

3. **Application runs but doesn't respond to requests**
   - If the application is running (as indicated by the logs) but doesn't respond when you access the URL, there could be several issues.
   - Solution:
     - Update the Dockerfile to include a startup script that checks if the application is responding:
       ```dockerfile
       # Create a startup script that includes health check
       RUN echo '#!/bin/sh\n\
       echo "Starting risk dashboard..."\n\
       ./target/release/risk_dashboard &\n\
       PID=$!\n\
       echo "Waiting for server to start..."\n\
       sleep 10\n\
       echo "Checking health endpoint..."\n\
       curl -v http://localhost:8080/health\n\
       echo "Checking static files..."\n\
       curl -v http://localhost:8080/\n\
       echo "Server is running with PID $PID"\n\
       wait $PID\n\
       ' > /app/start.sh && chmod +x /app/start.sh
       
       # Use the startup script
       CMD ["/app/start.sh"]
       ```
     - This will help diagnose if the application is binding correctly and responding to requests.
     - For more detailed troubleshooting, see the RENDER_DEPLOYMENT_DEBUG.md file.

4. **Application crashes immediately after deployment**
   - Check the Render logs for error messages
   - Ensure all required environment variables are set
   - Verify that the `PORT` and `DASHBOARD_PORT` environment variables are set to 8080

2. **"Connection refused" or "Cannot connect to server" errors**
   - Make sure your application is binding to `0.0.0.0` (all interfaces), not localhost
   - Verify that your application is listening on the port specified by the `PORT` environment variable

3. **Health check failures**
   - Ensure your application has a `/health` endpoint that returns a 200 OK response
   - Check the health check path in your `render.docker.yaml` file

4. **Docker build failures**
   - Check the Render logs for build errors
   - Ensure your `Dockerfile.render` is valid and all dependencies are correctly specified

### Debugging

1. Use the Render logs to diagnose issues:
   - Go to your service in the Render dashboard
   - Click on "Logs" to view the application logs
   - Look for error messages or warnings

2. Test your Docker configuration locally using the `docker_debug.sh` script

3. If you're still having issues, try simplifying your application to isolate the problem

## Additional Resources

- [Render Docker Documentation](https://render.com/docs/docker)
- [Render Environment Variables](https://render.com/docs/environment-variables)
- [Render Blueprints](https://render.com/docs/blueprint-spec)

## Support

If you encounter any issues not covered in this guide, please:
1. Check the Render documentation
2. Look for similar issues in the project repository
3. Contact Render support if it appears to be a platform-specific issue 