# HyperLiquid Risk Dashboard

A web-based dashboard for visualizing and monitoring risk metrics for HyperLiquid trading positions.

## Features

- Real-time monitoring of portfolio risk metrics
- Interactive charts for PnL, account value, and risk metrics
- Position-specific metrics and analysis
- Interactive Risk Warnings with severity indicators
- Informative tooltips for key metrics
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

- **Portfolio Heat**: Overall risk score for your portfolio (0-100) with tooltip explanation
- **Margin Utilization**: Percentage of available margin in use with tooltip explanation
- **Total Account Value**: Current account balance with tooltip explanation
- **Risk Warnings**: Clickable card showing count of active warnings with severity-based indicators and tooltip explanation

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

### Charts

- **PnL Over Time**: Track your unrealized profit and loss
- **Position Metrics**: Position-specific metrics including PnL and risk score
- **Risk Metrics**: View portfolio heat and margin utilization trends

All charts feature optimized layouts with proper margins and boundaries to ensure axis labels and data are clearly visible.

### Risk Warnings Modal

Clicking on the Risk Warnings card opens a modal with detailed information about each warning:
- Severity level (Low, Medium, High, Critical) with color coding
- Warning type and description
- Related position (if applicable)
- Suggested action to mitigate the risk

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

- Improved chart layouts with optimized margins and boundaries to prevent clipping
- Added informative tooltips to all summary cards for better understanding of metrics
- Improved layout with positions table moved above charts for better visibility
- Simplified position metrics chart to focus on key metrics (PnL and risk score)
- Added interactive Risk Warnings card with severity-based indicators
- Moved warnings to a modal dialog for cleaner interface
- Added improved error handling for chart data loading
- Fixed issues with PnL and Risk Metrics charts not displaying correctly
- Added debug tools for API troubleshooting
- Enhanced error messages with visual alerts
- Improved data validation for API responses

## License

This project is licensed under the MIT License - see the LICENSE file for details. 