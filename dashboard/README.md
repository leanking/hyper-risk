# HyperLiquid Risk Dashboard

A web-based dashboard for visualizing and monitoring risk metrics for HyperLiquid trading positions.

## Features

- Real-time monitoring of portfolio risk metrics
- Interactive charts for PnL, account value, and risk metrics
- Position-specific metrics and analysis
- Risk warnings and alerts
- Responsive design for desktop and mobile
- Debug tools for troubleshooting API issues
- User settings management

## Screenshots

![Dashboard Overview](screenshots/dashboard.png)

## Getting Started

### Prerequisites

- Rust and Cargo installed
- HyperLiquid Risk Management System running

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/hyper-risk.git
   cd hyper-risk
   ```

2. Build the project:
   ```
   cargo build --release
   ```

### Configuration

Create a `.env` file in the project root with the following variables:

```
WALLET_ADDRESS=your_hyperliquid_wallet_address
API_URL=https://api.hyperliquid.xyz
LOG_TO_CONSOLE=true
LOG_TO_DATABASE=false
LOG_INTERVAL_SECONDS=60
DASHBOARD_PORT=8080
```

### Running the Dashboard

Start the dashboard server:

```
cargo run --bin risk_dashboard
```

Then open your browser and navigate to:

```
http://localhost:8080
```

## Dashboard Components

### Risk Summary Cards

- **Portfolio Heat**: Overall risk score for your portfolio (0-100)
- **Margin Utilization**: Percentage of available margin in use
- **Highest Risk Position**: Position with the highest risk score
- **Risk Warnings**: Count of active risk warnings

### Charts

- **PnL Over Time**: Track your unrealized profit and loss
- **Account Value**: Monitor your total account value
- **Risk Metrics**: View portfolio heat and margin utilization trends
- **Position Metrics**: Position-specific metrics including PnL, risk score, and distance to liquidation

### Positions Table

Detailed view of all your current positions with key metrics:

- Coin
- Size
- Entry Price
- Leverage
- Liquidation Price
- Unrealized PnL
- Margin Used
- Position Value
- ROE
- Risk Score

### Risk Warnings

Active warnings with severity levels and suggested actions.

### Debug Tools

The dashboard includes a debug button that opens a modal with access to all API endpoints:

1. Click the "Debug" button in the dashboard header
2. Select an API endpoint from the list
3. View the raw JSON response
4. Use this to diagnose issues with data loading or chart display

This is particularly useful for troubleshooting issues with charts not displaying correctly or settings not saving properly.

## Troubleshooting

### Charts Not Displaying Data

If charts are not displaying data correctly:

1. Use the debug button to check API responses
2. Verify that the API endpoints are returning valid data
3. Check the browser console for JavaScript errors
4. Ensure your browser is up to date

### Settings Not Saving

If settings are not saving properly:

1. Check that the settings API endpoint is accessible
2. Verify that user_settings.json is writable
3. Check for error messages in the browser console

### Port Already in Use

If you see "Address already in use" error:

1. Another process is using port 8080
2. Change the port using the DASHBOARD_PORT environment variable
3. Or stop the other process using the port

## Customization

You can customize the dashboard by modifying the following files:

- `dashboard/static/css/styles.css`: Styling and theme
- `dashboard/static/js/dashboard.js`: Chart configurations and data processing
- `dashboard/static/index.html`: Layout and components

## Recent Updates

- Added improved error handling for chart data loading
- Fixed issues with PnL and Risk Metrics charts not displaying correctly
- Added debug tools for API troubleshooting
- Enhanced error messages with visual alerts
- Improved data validation for API responses

## License

This project is licensed under the MIT License - see the LICENSE file for details. 