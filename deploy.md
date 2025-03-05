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

## Step 4: Add a Render.yaml File (Optional)

For easier deployment, you can add a `render.yaml` file to your repository root:

```yaml
services:
  - type: web
    name: hyperliquid-risk-dashboard
    runtime: rust
    buildCommand: cargo build --release
    startCommand: ./target/release/risk_dashboard
    envVars:
      - key: WALLET_ADDRESS
        sync: false
      - key: API_URL
        value: https://api.hyperliquid.xyz
      - key: LOG_TO_CONSOLE
        value: true
      - key: LOG_TO_DATABASE
        value: false
      - key: LOG_INTERVAL_SECONDS
        value: 60
      - key: RATE_LIMIT_REQUESTS_PER_MINUTE
        value: 60
      - key: RATE_LIMIT_STATIC_PER_MINUTE
        value: 120
      - key: RATE_LIMIT_SETTINGS_PER_MINUTE
        value: 20
```

## Step 5: Deploy the Application

1. Click "Create Web Service" to start the deployment process
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

## Step 8: Monitor Your Application

1. Use the Render dashboard to monitor your application's logs and metrics
2. Set up alerts for any issues or errors
3. Monitor your application's performance and scale as needed

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

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Rust on Render](https://render.com/docs/deploy-rust)
- [Supabase Documentation](https://supabase.com/docs)
- [HyperLiquid API Documentation](https://hyperliquid.xyz/docs)

## Support

If you encounter any issues with the HyperLiquid Risk Management System, please open an issue on the GitHub repository or contact the maintainers directly. 