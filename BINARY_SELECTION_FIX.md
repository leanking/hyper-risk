# Binary Selection Fix for Render Deployment

## The Issue

When deploying the HyperLiquid Risk Dashboard to Render using Docker, you might encounter the following error:

```
error: `cargo run` could not determine which binary to run. Use the `--bin` option to specify a binary, or the `default-run` manifest key.
available binaries: agent, approve_builder_fee, bridge_withdraw, class_transfer, info, leverage, market_maker, market_order_and_cancel, market_order_with_builder_and_cancel, order_and_cancel, order_and_cancel_cloid, order_with_builder_and_cancel, risk_dashboard, risk_monitor, set_referrer, spot_order, spot_transfer, usdc_transfer, vault_transfer, ws_active_asset_ctx, ws_all_mids, ws_candles, ws_l2_book, ws_notification, ws_orders, ws_trades, ws_user_events, ws_user_fundings, ws_user_non_funding_ledger_updates, ws_web_data2
```

This error occurs because:
1. The project contains multiple binaries
2. Render doesn't know which binary to execute when running the container
3. The default `cargo run` command without specifying a binary fails when multiple binaries are available

## The Solution

There are two ways to fix this issue:

### Option 1: Directly Execute the Binary (Recommended)

Update the `Dockerfile.render` to directly execute the compiled binary instead of using `cargo run`:

```dockerfile
# Original line
# CMD ["sh", "-c", "cargo run --release"]

# Updated line - directly execute the binary
CMD ["sh", "-c", "./target/release/risk_dashboard"]
```

This approach:
- Is faster (doesn't need to invoke cargo)
- Uses less memory
- Is more reliable in production environments

### Option 2: Specify the Binary with Cargo Run

Alternatively, you can use the `--bin` option with `cargo run`:

```dockerfile
# Original line
# CMD ["sh", "-c", "cargo run --release"]

# Updated line - specify the binary
CMD ["sh", "-c", "cargo run --release --bin risk_dashboard"]
```

This approach:
- Is useful during development
- Allows for cargo features to be used
- May consume more resources

## Implementation

1. Edit your `Dockerfile.render` file to use one of the approaches above
2. Rebuild and redeploy your application
3. Check the Render logs to ensure the correct binary is being executed

## Additional Configuration

If you want to set a default binary for your project, you can add the following to your `Cargo.toml` file:

```toml
[package]
# ... other package settings ...
default-run = "risk_dashboard"
```

This will make `cargo run` default to the `risk_dashboard` binary when no `--bin` option is specified.

## References

- [Cargo Workspaces Documentation](https://doc.rust-lang.org/cargo/reference/workspaces.html)
- [Render Docker Deployment](https://render.com/docs/docker)
- [Cargo.toml Reference](https://doc.rust-lang.org/cargo/reference/manifest.html#the-default-run-field) 