# Deploying HyperLiquid Risk Management System to Render

This guide provides detailed instructions for deploying the HyperLiquid Risk Management System to [Render](https://render.com), a cloud platform that makes it easy to deploy and scale web applications.

## Prerequisites

Before you begin, make sure you have:

1. A [Render account](https://dashboard.render.com/register)
2. A [GitHub account](https://github.com/join) (for storing your repository)
3. Your HyperLiquid wallet address
4. (Optional) A Supabase account and project if you want to use database logging

## Step 1: Prepare Your Repository

1. Fork or clone the HyperLiquid Risk Management System repository to your GitHub account
2. Make sure your repository includes all the necessary files:
   - `Cargo.toml` and `Cargo.lock`
   - `src/` directory with all Rust code
   - `dashboard/` directory with static files
   - `.gitignore` (should exclude `.env` and any sensitive files)

## Step 2: Set Up Render Web Service

1. Log in to your [Render Dashboard](https://dashboard.render.com)
2. Click on the "New +" button and select "Web Service"
3. Connect your GitHub account if you haven't already
4. Select the repository containing your HyperLiquid Risk Management System
5. Configure the web service with the following settings:

   - **Name**: Choose a name for your service (e.g., `hyperliquid-risk-dashboard`)
   - **Region**: Choose a region closest to your users
   - **Branch**: `main` (or your preferred branch)
   - **Runtime**: `Rust`
   - **Build Command**: `cargo build --release`
   - **Start Command**: `./target/release/risk_dashboard`
   - **Plan**: Choose an appropriate plan (at least the "Starter" plan is recommended)

## Step 3: Configure Environment Variables

In the Render dashboard, add the following environment variables under the "Environment" section:

### Required Variables

- `WALLET_ADDRESS`: Your HyperLiquid wallet address

### Optional Variables with Defaults

- `API_URL`: HyperLiquid API URL (defaults to `https://api.hyperliquid.xyz`)
- `LOG_TO_CONSOLE`: Whether to log to console (defaults to `true`)
- `LOG_TO_DATABASE`: Whether to log to database (defaults to `false`)
- `LOG_INTERVAL_SECONDS`: How often to log data in seconds (defaults to `60`)
- `DASHBOARD_PORT`: Port for the dashboard (defaults to `8080`, but Render will override this with `PORT`)
- `RATE_LIMIT_REQUESTS_PER_MINUTE`: Maximum number of API requests allowed per minute per client IP (defaults to `60`)
- `RATE_LIMIT_STATIC_PER_MINUTE`: Maximum number of static file requests allowed per minute per client IP (defaults to `120`)
- `RATE_LIMIT_SETTINGS_PER_MINUTE`: Maximum number of settings API requests allowed per minute per client IP (defaults to `20`)

### Risk Limit Variables (Optional with Defaults)

- `MAX_POSITION_SIZE_USD`: Maximum position size in USD (defaults to `100000`)
- `MAX_LEVERAGE`: Maximum allowed leverage (defaults to `50`)
- `MAX_DRAWDOWN_PCT`: Maximum allowed drawdown percentage (defaults to `15`)
- `MAX_POSITION_PCT`: Maximum position size as percentage of portfolio (defaults to `20`)
- `MIN_DISTANCE_TO_LIQ`: Minimum safe distance to liquidation price (defaults to `10`)
- `MAX_CORRELATION`: Maximum allowed correlation between positions (defaults to `0.7`)
- `MAX_MARGIN_UTILIZATION`: Maximum margin utilization percentage (defaults to `80`)

### Supabase Variables (Required if LOG_TO_DATABASE=true)

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase API key (service role key)

## Step 4: Add a Render.yaml File (Recommended)

For easier deployment and infrastructure-as-code practices, add a `render.yaml` file to your repository root. This allows for Blueprint deployments and makes it easier to maintain consistent environments.

Create a file named `render.yaml` in the root of your repository with the following content:

```yaml
services:
  - type: web
    name: hyperliquid-risk-dashboard
    runtime: rust
    plan: starter
    region: oregon  # Change to your preferred region
    buildCommand: |
      # Set up cargo cache to speed up builds
      mkdir -p /opt/render/project/.cargo
      cat > /opt/render/project/.cargo/config.toml << EOF
      [build]
      target-dir = "/opt/render/project/.cargo/target"
      [net]
      git-fetch-with-cli = true
      EOF
      # Use release profile with optimizations for build speed
      RUSTFLAGS="-C opt-level=1" cargo build --release
    startCommand: ./target/release/risk_dashboard
    healthCheckPath: /health
    autoDeploy: true
    # Cache configuration for faster builds
    cache:
      - name: cargo-cache
        mountPath: /opt/render/project/.cargo
        type: volume
        sizeGB: 5
    envVars:
      - key: WALLET_ADDRESS
        sync: false  # This will prompt for the value during deployment
      - key: API_URL
        value: https://api.hyperliquid.xyz
      - key: LOG_TO_CONSOLE
        value: "true"
      - key: LOG_TO_DATABASE
        value: "false"
      - key: LOG_INTERVAL_SECONDS
        value: "60"
      - key: DASHBOARD_PORT
        value: "8080"
      - key: RATE_LIMIT_REQUESTS_PER_MINUTE
        value: "60"
      - key: RATE_LIMIT_STATIC_PER_MINUTE
        value: "120"
      - key: RATE_LIMIT_SETTINGS_PER_MINUTE
        value: "20"
      - key: MAX_POSITION_SIZE_USD
        value: "100000"
      - key: MAX_LEVERAGE
        value: "50"
      - key: MAX_DRAWDOWN_PCT
        value: "15"
      - key: MAX_POSITION_PCT
        value: "20"
      - key: MIN_DISTANCE_TO_LIQ
        value: "10"
      - key: MAX_CORRELATION
        value: "0.7"
      - key: MAX_MARGIN_UTILIZATION
        value: "80"
      # Uncomment and set these if using Supabase
      # - key: SUPABASE_URL
      #   sync: false
      # - key: SUPABASE_KEY
      #   sync: false
```

With this file in your repository, you can deploy your application using Render Blueprints:

1. Go to the Render dashboard and click "New" > "Blueprint"
2. Connect your repository
3. Render will automatically detect the `render.yaml` file and set up the services as defined
4. You'll be prompted to enter values for any environment variables with `sync: false`

## Step 5: Deploy the Application

1. Click "Create Web Service" (or "Apply Blueprint" if using render.yaml) to start the deployment process
2. Render will automatically build and deploy your application
3. Once deployment is complete, you'll receive a URL for your application (e.g., `https://hyperliquid-risk-dashboard.onrender.com`)

## Step 6: Set Up Database Logging (Optional)

If you want to use database logging with Supabase:

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Set up the required tables using the SQL scripts provided in the repository:
   - Use `supabase_setup.sql` or `simple_table_setup.sql` from the repository
3. Get your Supabase URL and API key from the Supabase dashboard
4. Add these as environment variables in your Render service:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_KEY`: Your Supabase service role API key
5. Set `LOG_TO_DATABASE` to `true` in your Render environment variables

## Step 7: Set Up Continuous Deployment (Optional)

Render automatically sets up continuous deployment from your GitHub repository. Whenever you push changes to your repository, Render will automatically rebuild and redeploy your application.

You can configure auto-deployment settings in the Render dashboard:

1. Go to your web service in the Render dashboard
2. Click on "Settings" > "Build & Deploy"
3. Configure auto-deploy settings according to your preferences

## Step 8: Monitor Your Application

1. Use the Render dashboard to monitor your application's logs and metrics
2. Set up alerts for any issues or errors
3. Monitor your application's performance and scale as needed

## Step 9: Optimizing Build Times

Rust applications can have long build times on Render, especially for the first deployment. Here are strategies to improve build performance:

### Use Build Caching

The `render.yaml` file above includes cache configuration that significantly speeds up subsequent builds by preserving the Cargo cache between deployments:

```yaml
cache:
  - name: cargo-cache
    mountPath: /opt/render/project/.cargo
    type: volume
    sizeGB: 5
```

### Optimize Compilation Settings

The build command uses `opt-level=1` which provides a good balance between build speed and runtime performance:

```bash
RUSTFLAGS="-C opt-level=1" cargo build --release
```

For even faster builds (but potentially slower runtime), you can use `opt-level=0`.

### Additional Optimization Strategies

1. **Use Cargo Workspaces**: If your project has multiple crates, organize them in a Cargo workspace to share build artifacts.

2. **Reduce Dependencies**: Review your `Cargo.toml` and remove unnecessary dependencies.

3. **Use Specific Dependency Versions**: Pin dependencies to specific versions to avoid recompilation when new versions are released.

4. **Consider Using Docker**: For complex builds, you can use a pre-built Docker image with your dependencies already compiled.

5. **Upgrade to a Higher-Tier Plan**: Render's higher-tier plans provide more CPU resources, which can significantly speed up compilation.

6. **Split Your Application**: Consider splitting your application into smaller services that can be built and deployed independently.

### Monitoring Build Performance

You can monitor build times in the Render dashboard under the "Logs" tab during deployment. Look for patterns in what's taking the most time and optimize accordingly.

## Step 10: Alternative Deployment Method Using Docker

For significantly faster builds and deployments, you can use Docker with Render. This approach pre-builds dependencies and can dramatically reduce deployment times.

### Setting Up Docker Deployment

1. Add a `Dockerfile` to your repository root:

```Dockerfile
# Use a multi-stage build for smaller final image
FROM rust:1.76-slim as builder

# Create a new empty shell project
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y pkg-config libssl-dev

# Copy over your manifests
COPY Cargo.toml Cargo.lock ./

# This is a trick to pre-build dependencies
# Create a dummy main.rs that will compile successfully
RUN mkdir -p src && \
    echo "fn main() {println!(\"if you see this, the build broke\")}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Now copy your actual source code
COPY src ./src
COPY dashboard ./dashboard

# Build for release with optimized settings
RUN touch src/main.rs && \
    RUSTFLAGS="-C target-cpu=native" cargo build --release

# Final stage: create a slim image
FROM debian:bullseye-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy the build artifact from the builder stage
COPY --from=builder /usr/src/app/target/release/risk_dashboard /usr/local/bin/

# Copy static files
COPY --from=builder /usr/src/app/dashboard /usr/local/bin/dashboard

# Set the startup command
WORKDIR /usr/local/bin
ENV DASHBOARD_PORT=8080
EXPOSE 8080

# Run as non-root user for better security
RUN useradd -m appuser
USER appuser

CMD ["risk_dashboard"]
```

2. Update your `render.yaml` to use Docker:

```yaml
services:
  - type: web
    name: hyperliquid-risk-dashboard
    plan: starter
    region: oregon
    runtime: docker
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: WALLET_ADDRESS
        sync: false
      # Include all other environment variables as in the standard deployment
```

### Benefits of Docker Deployment

1. **Faster Builds**: Docker caches each layer of the build process, significantly reducing build times for subsequent deployments.
2. **Consistent Environment**: Ensures the same environment for development, testing, and production.
3. **Optimized Dependencies**: The multi-stage build process minimizes the final image size.
4. **Better Resource Utilization**: Docker containers can be more efficient with system resources.

### Deploying with Docker

1. Push your repository with the Dockerfile to GitHub
2. In Render, create a new Web Service and select "Docker" as the runtime
3. Configure the service with your environment variables
4. Deploy the service

This approach can reduce build times from 30+ minutes to just a few minutes, especially for subsequent deployments.

## Troubleshooting

### Application Not Starting

If your application fails to start, check the logs in the Render dashboard for any errors. Common issues include:

- Missing environment variables
- Build failures due to missing dependencies
- Port configuration issues

### Database Connection Issues

If you're using Supabase and experiencing connection issues:

1. Verify your Supabase URL and API key are correct
2. Check that your Supabase project is active and not in maintenance mode
3. Ensure your IP is not blocked by Supabase's security settings

### Performance Issues

If your application is slow or unresponsive:

1. Consider upgrading to a higher-tier Render plan
2. Optimize your code for better performance
3. Consider using Render's auto-scaling features for handling high traffic

### Application Availability and Loading Issues

If your application was running but is now stuck in a loading loop or unavailable:

1. **Check Service Status in Render Dashboard**:
   - Go to your Render dashboard and check if the service is showing as "Live"
   - Look for any recent deployment failures or crashes
   - Check the service logs for error messages or exceptions

2. **Health Check Issues**:
   - Verify that your health check endpoint (`/health`) is properly implemented and responding
   - If the health check is failing, Render might be restarting your service repeatedly
   - You can temporarily disable the health check in your render.yaml to see if that resolves the issue

3. **Memory or Resource Limitations**:
   - Check if your application is hitting memory limits (visible in Render metrics)
   - Consider upgrading to a higher plan if you're consistently using all available resources

4. **Custom Domain Configuration**:
   - Ensure your DNS settings are correctly configured for your custom domain
   - Verify that the SSL certificate for your custom domain has been properly provisioned
   - Try accessing the application using the original Render URL (e.g., `https://hyperliquid-risk-dashboard.onrender.com`)
   - Note that DNS propagation can take up to 48 hours in some cases

5. **Render URL Access**:
   - The Render URL should always work regardless of custom domain configuration
   - If the Render URL is also stuck in a loading loop, the issue is with the application itself
   - Check if you've implemented any redirect logic that might be causing an infinite loop

6. **Network and Firewall Issues**:
   - Try accessing the application from a different network or device
   - Check if your network has any firewall rules that might be blocking access

7. **Application Initialization**:
   - Check if your application is taking too long to initialize
   - Look for any startup tasks that might be timing out

### Service Shows as "Live" but Not Responding

If your Render service shows as "Live" but the application is not responding (stuck in a loading loop) and logs haven't updated recently:

1. **Check for Application Deadlock**:
   - Your application might be running but in a deadlocked or frozen state
   - This can happen if there are thread deadlocks, infinite loops, or resource exhaustion
   - The application process is still running (so Render shows it as "Live") but it's not processing requests

2. **Memory Leaks**:
   - Check if your application is using excessive memory
   - Memory leaks can cause the application to become unresponsive without crashing
   - In the Render dashboard, check the memory usage graph for your service

3. **Connection Pool Issues**:
   - If your application uses database connections or other external resources
   - Connection pools might be exhausted or in an invalid state
   - This is common when connections aren't properly closed after errors

4. **Restart the Service**:
   - In the Render dashboard, click the "Manual Deploy" button
   - Select "Deploy latest commit" (or "Clear build cache & deploy" if you suspect cache issues)
   - This will restart your application without rebuilding it

5. **Check for Long-Running Operations**:
   - Your application might be stuck in a long-running operation
   - Check if there are any background tasks, API calls, or database operations that could be timing out

6. **Inspect Recent Logs Before the Silence**:
   - Look at the last few log entries before the 15-minute silence
   - They might contain warnings or errors that indicate what caused the application to stop responding

7. **Verify Port Configuration**:
   - Ensure your application is listening on the correct port
   - Render sets the `PORT` environment variable, and your application must use this port
   - Check that your code properly reads and uses the `PORT` environment variable

8. **Implement Better Logging**:
   - Add periodic heartbeat logs to your application
   - Log startup completion and readiness to serve requests
   - This will help identify if the application is truly running or stuck in initialization

### Fixing a Stuck Deployment

If your deployment appears stuck or in an error state:

1. **Force a Redeployment**:
   - In the Render dashboard, go to your service
   - Click on "Manual Deploy" > "Clear build cache & deploy"
   - This will force a fresh build and deployment

2. **Rollback to Previous Version**:
   - If a recent change caused the issue, you can roll back to a previous working version
   - In the Render dashboard, find a previous successful deployment and click "Rollback to this deploy"

3. **Check for Render Status Issues**:
   - Visit [Render Status](https://status.render.com) to check if there are any ongoing platform issues

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Render Blueprints](https://render.com/docs/blueprint-spec)
- [Rust on Render](https://render.com/docs/deploy-rust)
- [Supabase Documentation](https://supabase.com/docs)
- [HyperLiquid API Documentation](https://hyperliquid.xyz/docs)

## Support

If you encounter any issues with the HyperLiquid Risk Management System, please open an issue on the GitHub repository or contact the maintainers directly. 