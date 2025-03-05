# HyperLiquid Risk Management System - Usage Guide

## Overview

The HyperLiquid Risk Management System is a comprehensive tool for monitoring and analyzing risk exposure on the HyperLiquid exchange. It provides real-time risk assessment, metrics, and warnings for your cryptocurrency trading positions.

## Installation

### Prerequisites

- Rust and Cargo installed on your system
- A HyperLiquid wallet address
- Optional: Supabase account (for database logging)

### Building from Source

```bash
git clone https://github.com/your-username/hyper-risk.git
cd hyper-risk
cargo build --release
```

The binaries will be available at:
- `target/release/risk_monitor` - Command-line risk monitoring tool
- `target/release/risk_dashboard` - Web-based dashboard interface

## Supabase Setup for Database Logging

If you want to use Supabase for persistent storage of risk data, follow these steps:

1. **Create a Supabase Account**
   - Sign up at [supabase.com](https://supabase.com)
   - Create a new project

2. **Set Up Your Database**
   - **Manual Setup (Recommended)**:
     1. Go to the SQL Editor in your Supabase dashboard
     2. Copy the entire contents of `simple_table_setup.sql`
     3. Paste it into the SQL Editor
     4. Click "Run"
     5. Verify in the Table Editor that the `risk_logs` table was created

   - **Automated Setup** (may not work in all environments):
     ```bash
     # Make sure your .env file has SUPABASE_URL and SUPABASE_KEY set
     ./check_and_create_table.sh
     ```

3. **Get Your API Credentials**
   - Go to Project Settings > API
   - Copy the "Project URL" (for `SUPABASE_URL`)
   - Under "Project API Keys", copy the "service_role" secret (for `SUPABASE_KEY`)
   - Add these to your `.env` file

4. **Test Database Connection**
   - Run the risk monitor with `LOG_TO_DATABASE=true`
   - Check the logs for successful database entries
   - You can also check the Supabase Table Editor to verify data is being inserted

## Configuration

The system is configured primarily through environment variables, which can be set directly or through a `.env` file in the project directory.

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `WALLET_ADDRESS` | Your HyperLiquid wallet address (0x format) | `0xC9739116b8759B5a0B5834Ed62E218676EA9776F` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_URL` | HyperLiquid API URL | `https://api.hyperliquid.xyz` |
| `LOG_TO_CONSOLE` | Whether to log to console | `true` |
| `LOG_TO_DATABASE` | Whether to log to database | `false` |
| `LOG_INTERVAL_SECONDS` | How often to log data (in seconds) | `60` |
| `DASHBOARD_PORT` | Port for the web dashboard | `8080` |

### Database Configuration (Required if LOG_TO_DATABASE=true)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Your Supabase API key |

### Risk Limit Configuration

All risk limits are optional and have sensible defaults:

| Variable | Description | Default |
|----------|-------------|---------|
| `MAX_POSITION_SIZE_USD` | Maximum position size in USD | `100000` |
| `MAX_LEVERAGE` | Maximum allowed leverage | `50` |
| `MAX_DRAWDOWN_PCT` | Maximum allowed drawdown percentage | `15` |
| `MAX_POSITION_PCT` | Maximum position size as percentage of portfolio | `20` |
| `MIN_DISTANCE_TO_LIQ` | Minimum safe distance to liquidation price (%) | `10` |
| `MAX_CORRELATION` | Maximum allowed correlation between positions | `0.7` |
| `MAX_MARGIN_UTILIZATION` | Maximum margin utilization percentage | `80` |

### Sample .env File

```
# Required
export WALLET_ADDRESS=0xC9739116b8759B5a0B5834Ed62E218676EA9776F

# Optional with defaults
export API_URL=https://api.hyperliquid.xyz
export LOG_TO_CONSOLE=true
export LOG_TO_DATABASE=true
export LOG_INTERVAL_SECONDS=60
export DASHBOARD_PORT=8080

# Supabase configuration (required if LOG_TO_DATABASE=true)
export SUPABASE_URL=https://your-project-id.supabase.co
export SUPABASE_KEY=your-supabase-key

# Risk limits (all optional with defaults)
export MAX_POSITION_SIZE_USD=100000
export MAX_LEVERAGE=50
export MAX_DRAWDOWN_PCT=15
export MAX_POSITION_PCT=20
export MIN_DISTANCE_TO_LIQ=10
export MAX_CORRELATION=0.7
export MAX_MARGIN_UTILIZATION=80
```

## Running the Program

### Risk Monitor (Command Line)

To start the risk management system:

```bash
cargo run --bin risk_monitor
```

Or if you've built the release version:

```bash
./target/release/risk_monitor
```

### Risk Dashboard (Web Interface)

To start the web-based dashboard:

```bash
cargo run --bin risk_dashboard
```

Or if you've built the release version:

```bash
./target/release/risk_dashboard
```

Then open your browser and navigate to:

```
http://localhost:8080
```

## Understanding the Output

The system provides several types of output:

### Console Output

When running with `LOG_TO_CONSOLE=true`, the system will display:

1. A welcome message and configuration summary
2. Initial risk analysis results
3. Periodic risk summaries
4. Warnings when risk thresholds are exceeded

Example console output:
```
Time: 2025-03-05 19:48:09 UTC
=============================================
PORTFOLIO METRICS:
  Portfolio Heat:       20.81%
  Margin Utilization:   15.53%
  Concentration Score:  30.35
  Risk Adjusted Return: 0.24
  Account Value:        $14490.22
  Unrealized PnL:       $134.44
  Average Leverage:     11.63x

POSITIONS:
COIN       SIZE       LEV        RISK       LIQ DIST   PNL       
BTC        0.12       12.0      x 77.5       13.26     % $180.26    
XRP        -1750.00   12.0      x 36.5       158.44    % $-52.42    
NEIROETH   -20000.00  5.0       x 9.3        732.46    % $6.60      

RISK WARNINGS:
[Medium]   BTC: Position size is 67.88% of portfolio (threshold: 20.00%)
  Suggested Action: Consider reducing the size of the BTC position to improve diversification.
[Medium]   XRP: Position size is 26.86% of portfolio (threshold: 20.00%)
  Suggested Action: Consider reducing the size of the XRP position to improve diversification.
=============================================
```

### Log Files

When enabled, detailed logs are stored in JSON format with timestamps, position data, portfolio metrics, and risk warnings.

### Database Logs

When `LOG_TO_DATABASE=true`, logs are sent to your Supabase database in the `risk_logs` table, allowing for historical analysis and visualization.

## Dashboard Features

The web-based dashboard provides a comprehensive visual interface for monitoring your risk metrics:

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

### Settings Management

Configure risk limits directly through the dashboard interface.

### Debug Tools

The dashboard includes a debug interface to help troubleshoot API issues:
- View raw API responses
- Test individual endpoints
- Monitor data flow

## Risk Metrics

The system calculates and monitors several key risk metrics:

### Portfolio-Level Metrics

- **Portfolio Heat**: A 0-100 score based on leverage and liquidation risk
- **Concentration Score**: A measure of portfolio diversification
- **Risk-Adjusted Return**: Returns normalized by risk exposure
- **Margin Utilization**: Percentage of available margin in use
- **Total Unrealized PnL**: Sum of all positions' unrealized profit/loss
- **Account Value**: Total account value
- **Total Position Value**: Sum of all position values
- **Average Leverage**: Weighted average leverage across positions

### Position-Level Metrics

- **Distance to Liquidation**: Percentage gap to liquidation price
- **Position Size Ratio**: Position size relative to account value
- **Risk Score**: A 0-100 composite risk rating per position
- **Contribution to Portfolio**: How much a position contributes to overall portfolio risk

## Risk Warnings

The system generates warnings when thresholds are exceeded:

- **High Leverage**: When position leverage exceeds the configured maximum
- **Liquidation Risk**: When positions are close to liquidation
- **Position Size Exceeded**: When positions are too large relative to portfolio
- **High Concentration**: When portfolio is insufficiently diversified
- **Margin Utilization High**: When margin usage approaches maximum
- **Max Drawdown Exceeded**: When losses exceed maximum drawdown threshold
- **Overall Portfolio Risk**: When multiple risk factors combine to create high risk

Each warning includes:
- Warning type
- Severity level (Low, Medium, High, Critical)
- Description message
- Suggested action to mitigate the risk
- Related position (if applicable)

## Troubleshooting

### General Issues

If the program fails to start or connect:

1. Ensure your wallet address is correctly formatted
2. Check that the API URL is accessible
3. Verify your Supabase credentials if database logging is enabled
4. Check your internet connection
5. Ensure you have sufficient permissions to write log files

### Dashboard Issues

If you encounter issues with the dashboard:

1. **Charts Not Displaying Data**:
   - Use the debug button to check API responses
   - Verify that the API endpoints are returning valid data
   - Check the browser console for JavaScript errors
   - Ensure your browser is up to date

2. **Settings Not Saving**:
   - Check that the settings API endpoint is accessible
   - Verify that user_settings.json is writable
   - Check for error messages in the browser console

3. **Port Already in Use**:
   - If you see "Address already in use" error, another process is using port 8080
   - Change the port using the DASHBOARD_PORT environment variable
   - Or stop the other process using the port

### Database Logging Issues

If you see errors like `Failed to log to database. Status: 404 Not Found`:

1. **Create the Table Manually**:
   - Go to the Supabase SQL Editor
   - Copy and paste the contents of `simple_table_setup.sql`
   - Click "Run"
   - Verify in the Table Editor that the `risk_logs` table was created

2. **Verify API Credentials**:
   - Ensure you're using the correct Supabase URL (no trailing slash)
   - Make sure you're using the "service_role" key, not the "anon" key
   - Check that your API key has not expired or been revoked

3. **Check REST API Access**:
   - In Supabase, go to Settings > API > API Settings
   - Ensure "Row Level Security (RLS)" is properly configured
   - Verify that the table has the correct RLS policies

4. **Test API Manually**:
   ```bash
   curl -X POST "https://your-project-id.supabase.co/rest/v1/risk_logs" \
     -H "apikey: your-supabase-key" \
     -H "Authorization: Bearer your-supabase-key" \
     -H "Content-Type: application/json" \
     -H "Prefer: return=minimal" \
     -d '{"timestamp": 1614556800, "positions": [], "portfolio_metrics": {}, "position_metrics": [], "warnings": []}'
   ```

5. **Check for Existing Tables**:
   - The system will automatically try to use alternative table names if `risk_logs` doesn't exist
   - Check if there are tables named `risk_data`, `trading_risk`, or `position_logs`

## Advanced Usage

### Custom Analysis Frequency

Adjust `LOG_INTERVAL_SECONDS` to change how often risk analysis is performed. Lower values provide more frequent updates but may increase API usage.

### Integration with Monitoring Systems

The console output and log files can be integrated with monitoring systems like Prometheus, Grafana, or custom dashboards to visualize risk over time.

### Alert Configuration

Risk warnings can be configured to trigger external alerts by modifying the thresholds in the environment variables. 

### Using the Debug Interface

The dashboard includes a debug button that opens a modal with access to all API endpoints:

1. Click the "Debug" button in the dashboard header
2. Select an API endpoint from the list
3. View the raw JSON response
4. Use this to diagnose issues with data loading or chart display

This is particularly useful for troubleshooting issues with charts not displaying correctly or settings not saving properly. 