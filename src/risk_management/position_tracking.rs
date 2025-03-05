use ethers::types::H160;
use crate::info::info_client::InfoClient;
use crate::prelude::*;
use crate::risk_management::{Position, RiskConfig};

/// Position tracking system for monitoring open trading positions
pub struct PositionTracker {
    info_client: InfoClient,
    wallet_address: H160,
    last_positions: Vec<Position>,
    pub config: RiskConfig,
}

impl PositionTracker {
    /// Creates a new position tracker with the provided configuration
    pub async fn new(config: RiskConfig) -> Result<Self> {
        let info_client = InfoClient::new(None, Some(config.base_url)).await?;
        
        Ok(Self {
            info_client,
            wallet_address: config.wallet_address,
            last_positions: Vec::new(),
            config,
        })
    }
    
    /// Updates the configuration
    pub fn update_config(&mut self, config: RiskConfig) {
        self.wallet_address = config.wallet_address;
        self.config = config;
    }
    
    /// Fetches current positions from the Hyperliquid API
    pub async fn get_current_positions(&mut self) -> Result<Vec<Position>> {
        // Get user state from the API
        let user_state = self.info_client.user_state(self.wallet_address).await?;
        
        // Convert API response to our Position structs
        let positions: Vec<Position> = user_state
            .asset_positions
            .into_iter()
            .map(Position::from)
            // Only include positions with non-zero size
            .filter(|pos| pos.size.abs() > 0.0)
            .collect();
        
        // Update last positions
        self.last_positions = positions.clone();
        
        Ok(positions)
    }
    
    /// Returns the most recently fetched positions without making a new API call
    pub fn get_last_positions(&self) -> Vec<Position> {
        self.last_positions.clone()
    }
    
    /// Fetches account summary information
    pub async fn get_account_summary(&self) -> Result<AccountSummary> {
        let user_state = self.info_client.user_state(self.wallet_address).await?;
        
        Ok(AccountSummary {
            account_value: user_state.margin_summary.account_value.parse::<f64>().unwrap_or(0.0),
            margin_used: user_state.margin_summary.total_margin_used.parse::<f64>().unwrap_or(0.0),
            total_position_notional: user_state.margin_summary.total_ntl_pos.parse::<f64>().unwrap_or(0.0),
            withdrawable: user_state.withdrawable.parse::<f64>().unwrap_or(0.0),
        })
    }
    
    /// Subscribes to real-time position updates
    /// Not implemented in this version - would use WebSocket connection
    pub async fn subscribe_to_position_updates(&mut self) -> Result<()> {
        // This would use the WebSocket API to get real-time updates
        // For simplicity, we'll rely on polling in this implementation
        Ok(())
    }
}

/// Summary of account financial information
#[derive(Debug, Clone)]
pub struct AccountSummary {
    pub account_value: f64,
    pub margin_used: f64,
    pub total_position_notional: f64,
    pub withdrawable: f64,
} 