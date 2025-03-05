# hyperliquid-rust-sdk

SDK for Hyperliquid API trading with Rust.

## Hyperliquid Rust SDK

Hyperliquid's Rust SDK provides a convenient interface for interacting with the Hyperliquid exchange API.

## Risk Management System

This repository includes a comprehensive risk management system for cryptocurrency trading positions on the Hyperliquid exchange. The system provides real-time monitoring, risk assessment, and actionable insights to help traders maintain healthy risk profiles.

### Core Components

1. **Position Tracking System**
   - Monitors all open trading positions in real-time
   - Displays position details (size, leverage, entry price)
   - Calculates and shows real-time PnL
   - Monitors liquidation prices and distances

2. **Risk Calculation Engine**
   - Quantifies and assesses trading risks at multiple levels
   - Calculates portfolio-level metrics (heat, concentration, margin utilization)
   - Calculates position-level metrics (distance to liquidation, risk scores)

3. **Data Logging System**
   - Maintains historical record of positions and risk metrics
   - Supports console, file, and database logging options

4. **Risk Limits and Warnings**
   - Enforces risk management boundaries
   - Generates warnings when thresholds are exceeded
   - Provides actionable suggestions for risk reduction

### Usage

1. **Environment Setup**
   ```bash
   # Required
   export WALLET_ADDRESS=0x1234567890abcdef1234567890abcdef12345678

   # Optional with defaults
   export API_URL=https://api.hyperliquid.xyz
   export LOG_TO_CONSOLE=true
   export LOG_TO_DATABASE=false
   export LOG_INTERVAL_SECONDS=60
   
   # Required if LOG_TO_DATABASE=true
   export SUPABASE_URL=your_supabase_url_here
   export SUPABASE_KEY=your_supabase_key_here
   
   # Risk limits (all optional with defaults)
   export MAX_POSITION_SIZE_USD=100000
   export MAX_LEVERAGE=50
   export MAX_DRAWDOWN_PCT=15
   export MAX_POSITION_PCT=20
   export MIN_DISTANCE_TO_LIQ=10
   export MAX_CORRELATION=0.7
   export MAX_MARGIN_UTILIZATION=80
   ```

2. **Running the Risk Monitor**
   ```bash
   cargo run --bin risk_monitor
   ```

## SDK Usage

```rust
use hyperliquid_rust_sdk::exchange::ExchangeClient;
use hyperliquid_rust_sdk::prelude::*;
use ethers::signers::LocalWallet;

#[tokio::main]
async fn main() -> Result<()> {
    let wallet: LocalWallet = "your-private-key-here".parse()?;
    let client = ExchangeClient::new(None, wallet, None, None, None).await?;
    
    // Fetch open orders
    let orders = client.info.open_orders(client.wallet.address()).await?;
    
    // Place an order
    let order = client.market_open(
        MarketOrderParams {
            asset: "ETH",
            is_buy: true,
            sz: 1.0,
            reduce_only: false,
            price_steps: None,
        }
    ).await?;
    
    Ok(())
}
```

## Building the SDK

```bash
cargo build
```

## Testing

```bash
cargo test
```

## Documentation

For full documentation, see the SDK code and examples.

## Usage Examples

See `src/bin` for examples. You can run any example with `cargo run --bin [EXAMPLE]`.

## Installation

`cargo add hyperliquid_rust_sdk`

## License

This project is licensed under the terms of the `MIT` license. See [LICENSE](LICENSE.md) for more details.

```bibtex
@misc{hyperliquid-rust-sdk,
  author = {Hyperliquid},
  title = {SDK for Hyperliquid API trading with Rust.},
  year = {2024},
  publisher = {GitHub},
  journal = {GitHub repository},
  howpublished = {\url{https://github.com/hyperliquid-dex/hyperliquid-rust-sdk}}
}
```
