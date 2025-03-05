use ethers::types::H160;
use serde::{Deserialize, Serialize};
use std::env;
use std::str::FromStr;

use crate::helpers::BaseUrl;
use crate::prelude::*;
use crate::Error;

/// Configuration for the risk management system
#[derive(Debug, Clone)]
pub struct RiskConfig {
    // API and wallet configuration
    pub wallet_address: H160,
    pub base_url: BaseUrl,
    pub database_url: Option<String>,
    pub database_key: Option<String>,
    
    // Risk thresholds
    pub risk_limits: RiskLimits,
    
    // Logging configuration
    pub enable_logging: bool,
    pub log_to_console: bool,
    pub log_to_database: bool,
    pub log_interval_seconds: u64,
}

/// Risk thresholds and limits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskLimits {
    pub max_position_size_usd: f64,
    pub max_leverage: f64,
    pub max_drawdown_pct: f64,
    pub max_position_pct: f64,
    pub min_distance_to_liq: f64,
    pub max_correlation: f64,
    pub max_margin_utilization: f64,
}

impl Default for RiskLimits {
    fn default() -> Self {
        Self {
            max_position_size_usd: 100000.0,
            max_leverage: 50.0,
            max_drawdown_pct: 15.0,
            max_position_pct: 20.0,
            min_distance_to_liq: 10.0,
            max_correlation: 0.7,
            max_margin_utilization: 80.0,
        }
    }
}

impl RiskConfig {
    /// Creates a new configuration from environment variables
    pub fn from_env() -> Result<Self> {
        // Required values
        let wallet_address_str = env::var("WALLET_ADDRESS")
            .map_err(|_| Error::Custom("WALLET_ADDRESS environment variable not set".to_string()))?;
        
        let wallet_address = H160::from_str(&wallet_address_str)
            .map_err(|_| Error::Custom("Invalid WALLET_ADDRESS format".to_string()))?;
        
        // Optional values with defaults
        let base_url_str = env::var("API_URL").unwrap_or_else(|_| "https://api.hyperliquid.xyz".to_string());
        
        // Parse the base URL string to determine which endpoint to use
        let base_url = if base_url_str.contains("localhost") {
            BaseUrl::Localhost
        } else if base_url_str.contains("testnet") {
            BaseUrl::Testnet
        } else {
            BaseUrl::Mainnet
        };
        
        let database_url = env::var("SUPABASE_URL").ok();
        let database_key = env::var("SUPABASE_KEY").ok();
        
        let enable_logging = env::var("ENABLE_LOGGING")
            .map(|v| v.to_lowercase() == "true")
            .unwrap_or(true);
        
        let log_to_console = env::var("LOG_TO_CONSOLE")
            .map(|v| v.to_lowercase() == "true")
            .unwrap_or(true);
        
        let log_to_database = env::var("LOG_TO_DATABASE")
            .map(|v| v.to_lowercase() == "true")
            .unwrap_or(false);
        
        let log_interval_seconds = env::var("LOG_INTERVAL_SECONDS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(60);
        
        // Risk limits from environment variables or default
        let risk_limits = Self::risk_limits_from_env();
        
        Ok(Self {
            wallet_address,
            base_url,
            database_url,
            database_key,
            risk_limits,
            enable_logging,
            log_to_console,
            log_to_database,
            log_interval_seconds,
        })
    }
    
    /// Loads risk limits from environment variables or uses defaults
    fn risk_limits_from_env() -> RiskLimits {
        let mut limits = RiskLimits::default();
        
        if let Ok(val) = env::var("MAX_POSITION_SIZE_USD") {
            if let Ok(num) = val.parse::<f64>() {
                limits.max_position_size_usd = num;
            }
        }
        
        if let Ok(val) = env::var("MAX_LEVERAGE") {
            if let Ok(num) = val.parse::<f64>() {
                limits.max_leverage = num;
            }
        }
        
        if let Ok(val) = env::var("MAX_DRAWDOWN_PCT") {
            if let Ok(num) = val.parse::<f64>() {
                limits.max_drawdown_pct = num;
            }
        }
        
        if let Ok(val) = env::var("MAX_POSITION_PCT") {
            if let Ok(num) = val.parse::<f64>() {
                limits.max_position_pct = num;
            }
        }
        
        if let Ok(val) = env::var("MIN_DISTANCE_TO_LIQ") {
            if let Ok(num) = val.parse::<f64>() {
                limits.min_distance_to_liq = num;
            }
        }
        
        if let Ok(val) = env::var("MAX_CORRELATION") {
            if let Ok(num) = val.parse::<f64>() {
                limits.max_correlation = num;
            }
        }
        
        if let Ok(val) = env::var("MAX_MARGIN_UTILIZATION") {
            if let Ok(num) = val.parse::<f64>() {
                limits.max_margin_utilization = num;
            }
        }
        
        limits
    }
} 