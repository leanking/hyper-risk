# API Response Fix for Render Deployment

## The Issue

When deploying the HyperLiquid Risk Dashboard to Render, you might encounter the following issues:

1. API endpoints return HTML instead of JSON
2. 502 Bad Gateway errors for API requests
3. Error messages like:
   - `Error loading positions: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
   - `Error loading risk_summary: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
   - `Error loading risk_analysis: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
   - `HTTP error loading account_value: 502`
   - `No Risk Metrics data available to display`
4. "405 Method Not Allowed" errors when connecting to the HyperLiquid API

This happens because:
1. The application is running but not properly connecting to the HyperLiquid API
2. Required environment variables might be missing or incorrect
3. The application might be failing to authenticate with the HyperLiquid API
4. The frontend is receiving HTML error pages instead of JSON and trying to parse them
5. **IMPORTANT**: The HyperLiquid API requires POST requests for all endpoints, including `/info`

## The Solution

### 1. Fix the WALLET_ADDRESS Environment Variable

The most critical environment variable is `WALLET_ADDRESS`. Without it, the application cannot connect to the HyperLiquid API.

1. Go to your Render dashboard
2. Select your service
3. Click on "Environment" in the left sidebar
4. Check if `WALLET_ADDRESS` is set correctly
5. If not, add or update it with a valid HyperLiquid wallet address
6. Click "Save Changes" and redeploy your application

Make sure these environment variables are set in your Render dashboard:

```
WALLET_ADDRESS=your_hyperliquid_wallet_address
PORT=8080
DASHBOARD_PORT=8080
RUST_LOG=info
RENDER=true
```

### 2. Test Your Wallet Address Directly with the HyperLiquid API

Before deploying, verify that your wallet address works with the HyperLiquid API:

1. Run the `test_hyperliquid_api.sh` script:
   ```bash
   chmod +x test_hyperliquid_api.sh
   ./test_hyperliquid_api.sh your_wallet_address
   ```

2. If the script shows errors, your wallet address might be invalid or might not have the necessary permissions.

### 3. Ensure All API Requests Use POST Method

**IMPORTANT**: The HyperLiquid API requires POST requests for all endpoints, including `/info`.

If you're getting "405 Method Not Allowed" errors, make sure all API requests use the POST method:

```bash
# Correct way to call the info endpoint
curl -X POST "https://api.hyperliquid.xyz/info" -H "Content-Type: application/json" -d "{}"

# Correct way to call the exchange endpoint
curl -X POST "https://api.hyperliquid.xyz/exchange" -H "Content-Type: application/json" -d "{\"type\":\"clearinghouseState\",\"user\":\"your_wallet_address\"}"
```

Update your application code to ensure all API requests use POST:

```javascript
// JavaScript example
fetch('https://api.hyperliquid.xyz/info', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({}),
})
.then(response => response.json())
.then(data => console.log(data));
```

```rust
// Rust example
let client = reqwest::Client::new();
let response = client.post("https://api.hyperliquid.xyz/info")
    .json(&serde_json::json!({}))
    .send()
    .await?;
```

### 4. Update the Error Handling in Your Application

If you have access to the source code, consider updating the frontend to better handle API errors:

1. Add proper error handling for API requests:
   ```javascript
   fetch('/api/risk_summary')
     .then(response => {
       if (!response.ok) {
         throw new Error(`HTTP error ${response.status}`);
       }
       return response.json();
     })
     .then(data => {
       // Process data
     })
     .catch(error => {
       console.error('Error fetching risk summary:', error);
       // Display user-friendly error message
       displayErrorMessage('Could not load risk data. Please check your wallet address.');
     });
   ```

2. Add a check for HTML responses in your API handlers:
   ```javascript
   function isHtmlResponse(text) {
     return text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html');
   }

   fetch('/api/risk_summary')
     .then(response => response.text())
     .then(text => {
       if (isHtmlResponse(text)) {
         throw new Error('Received HTML instead of JSON');
       }
       return JSON.parse(text);
     })
     .then(data => {
       // Process data
     })
     .catch(error => {
       console.error('Error fetching risk summary:', error);
       displayErrorMessage('API returned invalid data. Please check your configuration.');
     });
   ```

### 5. Update the Backend Error Handling

If you have access to the backend code, improve the error handling:

1. Make sure API endpoints return proper JSON errors instead of HTML:
   ```rust
   async fn get_risk_summary(data: web::Data<Arc<AppState>>) -> Result<impl Responder> {
       let mut risk_system = data.risk_system.lock().unwrap();
       
       match risk_system.get_risk_summary().await {
           Ok(summary) => {
               // Return successful JSON response
               Ok(HttpResponse::Ok().json(summary))
           },
           Err(e) => {
               error!("Failed to get risk summary: {}", e);
               // Return JSON error instead of HTML
               Ok(HttpResponse::InternalServerError().json(json!({
                   "error": format!("Failed to get risk summary: {}", e)
               })))
           }
       }
   }
   ```

2. Add middleware to ensure all errors return JSON:
   ```rust
   // Add this to your App configuration
   App::new()
       .wrap_fn(|req, srv| {
           let fut = srv.call(req);
           async {
               match fut.await {
                   Ok(res) => Ok(res),
                   Err(e) => {
                       // Convert all errors to JSON responses
                       Ok(HttpResponse::InternalServerError().json(json!({
                           "error": format!("Server error: {}", e)
                       })).into_body())
                   }
               }
           }
       })
   ```

### 6. Update the Dockerfile for Better Debugging

Update your `Dockerfile.render` to include better error handling and debugging:

```dockerfile
# Create a startup script that includes health check and better error handling
RUN echo '#!/bin/sh\n\
echo "Starting risk dashboard..."\n\
\n\
# Check if WALLET_ADDRESS is set\n\
if [ -z "$WALLET_ADDRESS" ]; then\n\
    echo "ERROR: WALLET_ADDRESS environment variable is not set!"\n\
    echo "Please set WALLET_ADDRESS to your HyperLiquid wallet address."\n\
    exit 1\n\
fi\n\
\n\
echo "Environment variables:"\n\
echo "PORT=$PORT"\n\
echo "DASHBOARD_PORT=$DASHBOARD_PORT"\n\
echo "WALLET_ADDRESS=${WALLET_ADDRESS:0:6}...${WALLET_ADDRESS: -4}" # Show only part of the address for security\n\
echo "RUST_LOG=$RUST_LOG"\n\
echo "RENDER=$RENDER"\n\
echo "API_URL=$API_URL"\n\
\n\
# Test HyperLiquid API connectivity directly\n\
echo "Testing HyperLiquid API connectivity..."\n\
API_URL=${API_URL:-"https://api.hyperliquid.xyz"}\n\
\n\
# Test basic API connectivity - IMPORTANT: HyperLiquid API requires POST requests\n\
echo "1. Testing basic API connectivity..."\n\
INFO_RESPONSE=$(curl -s -X POST "$API_URL/info" -H "Content-Type: application/json" -d "{}")\n\
if [ -z "$INFO_RESPONSE" ]; then\n\
    echo "WARNING: Could not connect to HyperLiquid API at $API_URL"\n\
    echo "The application may not function correctly."\n\
else\n\
    echo "Successfully connected to HyperLiquid API at $API_URL"\n\
fi\n\
\n\
# Test user-specific API endpoint\n\
echo "2. Testing user-specific API endpoint..."\n\
USER_DATA=$(curl -s -X POST "$API_URL/exchange" -H "Content-Type: application/json" -d "{\"type\":\"clearinghouseState\",\"user\":\"$WALLET_ADDRESS\"}")\n\
if echo "$USER_DATA" | grep -q "error"; then\n\
    echo "WARNING: Could not connect to HyperLiquid API with the provided wallet address"\n\
    echo "Response:"\n\
    echo "$USER_DATA"\n\
    echo "The application may not function correctly."\n\
else\n\
    echo "Successfully connected to HyperLiquid API with the provided wallet address"\n\
fi\n\
\n\
# Start the application with backtrace enabled\n\
echo "Starting application with RUST_BACKTRACE=1 for better error reporting..."\n\
RUST_BACKTRACE=1 ./target/release/risk_dashboard &\n\
PID=$!\n\
\n\
# Wait for the server to start\n\
echo "Waiting for server to start..."\n\
sleep 10\n\
\n\
# Check API endpoints\n\
echo "Checking API endpoints..."\n\
\n\
echo "1. Testing /api/risk_summary:"\n\
RISK_SUMMARY=$(curl -s http://localhost:8080/api/risk_summary)\n\
if echo "$RISK_SUMMARY" | grep -q "<!DOCTYPE"; then\n\
    echo "WARNING: /api/risk_summary returned HTML instead of JSON"\n\
    echo "This indicates an API connection issue"\n\
else\n\
    echo "Response from /api/risk_summary (first 100 chars):"\n\
    echo "$RISK_SUMMARY" | head -c 100\n\
    echo "..."\n\
fi\n\
\n\
echo "Server is running with PID $PID"\n\
wait $PID\n\
' > /app/start.sh && chmod +x /app/start.sh
```

### 7. Common Error Messages and Solutions

#### SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON

This error occurs when:
- The frontend is trying to parse HTML as JSON
- The backend is returning HTML error pages instead of JSON responses
- The application is failing to connect to the HyperLiquid API

Solutions:
1. Verify your wallet address is correct and has the necessary permissions
2. Check that all required environment variables are set
3. Test the HyperLiquid API directly with your wallet address
4. Update the frontend code to better handle HTML responses
5. Update the backend code to return JSON errors instead of HTML

#### 405 Method Not Allowed

This error occurs when:
- You're using GET requests to access the HyperLiquid API
- The HyperLiquid API requires POST requests for all endpoints

Solutions:
1. Update all API requests to use POST method
2. Make sure to include the correct Content-Type header: `Content-Type: application/json`
3. Include a JSON body in the request, even if it's empty: `{}`

#### 502 Bad Gateway

This typically means:
- The application is running
- But the API request is failing or timing out
- Render is returning a 502 error

Solutions:
1. Increase the timeout settings in your application
2. Check for API connectivity issues
3. Verify that your wallet address has the necessary permissions
4. Check if the HyperLiquid API is experiencing downtime

#### No Risk Metrics data available to display

This usually means:
- The application is running
- The frontend is receiving a response from the backend
- But the response doesn't contain the expected data

Solutions:
1. Check if your wallet has any positions or activity on HyperLiquid
2. Verify that your wallet address is correct
3. Test the HyperLiquid API directly to see if it returns the expected data
4. Check the application logs for any errors related to data processing

## References

- [HyperLiquid API Documentation](https://hyperliquid.xyz/docs/api)
- [Render Environment Variables](https://render.com/docs/environment-variables)
- [Troubleshooting Render Deployments](https://render.com/docs/troubleshooting-deploys) 