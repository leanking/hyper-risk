# Render Deployment Debugging Guide

## Issue: Application Runs But Doesn't Respond to Requests

If your application is running on Render (as indicated by the logs) but doesn't respond when you access the URL, there could be several issues:

1. **Binding to the wrong interface**: The application might be binding to `localhost` or `127.0.0.1` instead of `0.0.0.0`
2. **Port configuration mismatch**: The application might be listening on a different port than what Render expects
3. **Static files not being served correctly**: The static files directory might not exist or have incorrect permissions
4. **Health check endpoint not working**: Render uses health checks to determine if your application is ready to serve traffic

## Solution

### 1. Verify Server Binding

Make sure your application is binding to `0.0.0.0` (all interfaces) and not just localhost:

```rust
// Correct binding
.bind(("0.0.0.0", port))?

// Incorrect binding (only accessible locally)
.bind(("127.0.0.1", port))?
```

### 2. Verify Port Configuration

Ensure your application is using the PORT environment variable provided by Render:

```rust
let port = env::var("PORT")
    .or_else(|_| env::var("DASHBOARD_PORT"))
    .ok()
    .and_then(|p| p.parse::<u16>().ok())
    .unwrap_or(8080);
```

### 3. Add Debugging to Startup

Update your Dockerfile to include a startup script that checks if the application is responding:

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

This script will:
1. Start your application in the background
2. Wait for it to initialize
3. Check if the health endpoint is responding
4. Check if static files are being served
5. Continue running the application

### 4. Check Static Files Directory

Ensure the static files directory exists and has the correct permissions:

```bash
# Check if directory exists
ls -la dashboard/static/

# Ensure correct permissions
chmod -R 755 dashboard/static/
```

### 5. Verify Health Check Endpoint

Make sure your application has a working health check endpoint that returns a 200 OK response:

```rust
// Health check endpoint for Render
async fn health_check() -> impl Responder {
    HttpResponse::Ok().body("OK")
}

// Add the endpoint to your routes
app = app.route("/health", web::get().to(health_check));
```

### 6. Check Render Logs

After deploying, check the Render logs for any errors or warnings:

1. Go to your service in the Render dashboard
2. Click on "Logs" to view the application logs
3. Look for error messages or warnings

### 7. Test Locally with Docker

Before deploying to Render, test your application locally with Docker:

```bash
docker build -t hyperliquid-risk-dashboard -f Dockerfile.render .
docker run -p 8080:8080 -e PORT=8080 -e DASHBOARD_PORT=8080 hyperliquid-risk-dashboard
```

Then try accessing:
- http://localhost:8080/health
- http://localhost:8080/

## Additional Troubleshooting

If the application still doesn't respond after these changes:

1. **Check for firewall issues**: Ensure Render's firewall isn't blocking your application
2. **Verify network configuration**: Check if there are any network-related issues in your application
3. **Simplify your application**: Temporarily remove complex features to isolate the issue
4. **Contact Render support**: If all else fails, contact Render support for assistance

Remember that Render expects your application to:
1. Listen on the port specified by the PORT environment variable
2. Bind to 0.0.0.0 (all interfaces)
3. Respond to health checks at the specified health check path
4. Start serving traffic within the health check timeout period 