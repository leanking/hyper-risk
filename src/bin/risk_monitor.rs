use std::env;
use std::time::Duration;
use tokio::time;
use log::{info, error};
use hyperliquid_rust_sdk::risk_management::{RiskManagementSystem, RiskConfig};
use hyperliquid_rust_sdk::Error;

#[tokio::main]
async fn main() -> std::result::Result<(), Error> {
    // Try to load variables from .env file if it exists
    // Note: This uses a direct environment file approach since we don't want to add
    // a dotenv dependency just for this one usage. In a production app, consider using the dotenv crate.
    if let Ok(env_content) = std::fs::read_to_string(".env") {
        for line in env_content.lines() {
            // Skip comments and empty lines
            if line.trim().starts_with('#') || line.trim().is_empty() {
                continue;
            }
            
            // Parse lines that start with "export " (for Unix-like environments)
            if let Some(env_line) = line.trim().strip_prefix("export ") {
                if let Some((key, value)) = env_line.split_once('=') {
                    // Strip quotes if present
                    let clean_value = value.trim().trim_matches('"').trim_matches('\'');
                    env::set_var(key.trim(), clean_value);
                }
            } 
            // Also try parsing direct KEY=VALUE format (for Windows or non-export lines)
            else if let Some((key, value)) = line.trim().split_once('=') {
                // Strip quotes if present
                let clean_value = value.trim().trim_matches('"').trim_matches('\'');
                env::set_var(key.trim(), clean_value);
            }
        }
    }
    
    // Initialize logging
    env_logger::init();
    
    // Print welcome message
    println!("========================================================");
    println!("            HYPERLIQUID RISK MANAGEMENT SYSTEM          ");
    println!("========================================================");
    println!("Starting risk monitoring...");
    
    // Load configuration from environment variables
    let config = match RiskConfig::from_env() {
        Ok(config) => config,
        Err(e) => {
            error!("Failed to load configuration: {}", e);
            println!("\nConfiguration Error: {}", e);
            println!("\nPlease set the required environment variables:");
            println!("  WALLET_ADDRESS: Your Hyperliquid wallet address (required)");
            println!("  API_URL: Hyperliquid API URL (optional, defaults to mainnet)");
            println!("  LOG_TO_CONSOLE: Whether to log to console (optional, defaults to true)");
            println!("  LOG_TO_DATABASE: Whether to log to database (optional, defaults to false)");
            println!("  SUPABASE_URL: Supabase URL (required if LOG_TO_DATABASE is true)");
            println!("  SUPABASE_KEY: Supabase API key (required if LOG_TO_DATABASE is true)");
            println!("  LOG_INTERVAL_SECONDS: How often to log data (optional, defaults to 60)");
            println!();
            println!("Risk limit environment variables (all optional with defaults):");
            println!("  MAX_POSITION_SIZE_USD: Maximum position size in USD");
            println!("  MAX_LEVERAGE: Maximum allowed leverage");
            println!("  MAX_DRAWDOWN_PCT: Maximum allowed drawdown percentage");
            println!("  MAX_POSITION_PCT: Maximum position size as percentage of portfolio");
            println!("  MIN_DISTANCE_TO_LIQ: Minimum safe distance to liquidation price");
            println!("  MAX_CORRELATION: Maximum allowed correlation between positions");
            println!("  MAX_MARGIN_UTILIZATION: Maximum margin utilization percentage");
            return Ok(());
        }
    };
    
    // Print Supabase configuration status
    if config.log_to_database {
        if config.database_url.is_some() && config.database_key.is_some() {
            println!("Supabase logging is enabled. Data will be logged to Supabase.");
        } else {
            println!("WARNING: Supabase logging is enabled but Supabase URL or API key is missing.");
            println!("Database logging will be skipped.");
        }
    }
    
    // Create risk management system
    let mut risk_system = match RiskManagementSystem::new(config.clone()).await {
        Ok(system) => system,
        Err(e) => {
            error!("Failed to initialize risk management system: {}", e);
            println!("Error: Failed to initialize risk management system: {}", e);
            return Err(e);
        }
    };
    
    // Run initial risk analysis
    println!("\nPerforming initial risk analysis...\n");
    match risk_system.analyze_risk_profile().await {
        Ok(_) => info!("Initial risk analysis completed"),
        Err(e) => {
            error!("Failed to perform initial risk analysis: {}", e);
            println!("Error: Failed to perform initial risk analysis: {}", e);
            return Err(e);
        }
    }
    
    // Print usage information
    println!("\nRisk monitor is running. Press Ctrl+C to exit.");
    println!("Analysis will be performed every {} seconds.", config.log_interval_seconds);
    println!("========================================================\n");
    
    // Main monitoring loop
    let interval_duration = Duration::from_secs(config.log_interval_seconds);
    let mut interval = time::interval(interval_duration);
    
    loop {
        // Wait for the next interval tick
        interval.tick().await;
        
        // Get risk summary
        match risk_system.get_risk_summary().await {
            Ok(summary) => {
                // Just log the summary to avoid too much console output between full analyses
                info!(
                    "Risk Summary - Heat: {:.2}, Margin Utilization: {:.2}%, Warnings: {}",
                    summary.portfolio_heat,
                    summary.margin_utilization,
                    summary.warning_count
                );
                
                // If high risk detected, perform full analysis
                if summary.portfolio_heat > 70.0 || summary.warning_count > 0 {
                    if let Err(e) = risk_system.analyze_risk_profile().await {
                        error!("Failed to perform risk analysis: {}", e);
                    }
                }
            }
            Err(e) => {
                error!("Failed to get risk summary: {}", e);
            }
        }
    }
} 