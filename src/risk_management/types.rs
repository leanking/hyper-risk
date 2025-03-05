use crate::info::AssetPosition;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

/// Represents a trading position with all relevant information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub coin: String,
    pub size: f64,
    pub entry_price: Option<f64>,
    pub leverage: f64, 
    pub liquidation_price: Option<f64>,
    pub unrealized_pnl: f64,
    pub margin_used: f64,
    pub position_value: f64,
    pub return_on_equity: f64,
    pub is_cross: bool,
    pub max_leverage: u32,
}

impl From<AssetPosition> for Position {
    fn from(asset_position: AssetPosition) -> Self {
        let position = &asset_position.position;
        Position {
            coin: position.coin.clone(),
            size: position.szi.parse::<f64>().unwrap_or(0.0),
            entry_price: position.entry_px.as_ref().and_then(|s| s.parse::<f64>().ok()),
            leverage: position.leverage.value as f64,
            liquidation_price: position.liquidation_px.as_ref().and_then(|s| s.parse::<f64>().ok()),
            unrealized_pnl: position.unrealized_pnl.parse::<f64>().unwrap_or(0.0),
            margin_used: position.margin_used.parse::<f64>().unwrap_or(0.0),
            position_value: position.position_value.parse::<f64>().unwrap_or(0.0),
            return_on_equity: position.return_on_equity.parse::<f64>().unwrap_or(0.0),
            is_cross: position.leverage.type_string == "cross",
            max_leverage: position.max_leverage,
        }
    }
}

/// Portfolio-level risk metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortfolioMetrics {
    pub portfolio_heat: f64,              // 0-100 score based on leverage and liquidation risk
    pub concentration_score: f64,         // measure of portfolio diversification
    pub risk_adjusted_return: f64,        // return normalized by risk exposure
    pub margin_utilization: f64,          // percentage of available margin in use
    pub total_unrealized_pnl: f64,        // sum of all positions' unrealized PnL
    pub account_value: f64,               // total account value
    pub total_position_value: f64,        // sum of all position values
    pub average_leverage: f64,            // weighted average leverage across positions
}

/// Position-level risk metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionMetrics {
    pub position: Position,
    pub distance_to_liquidation: f64,     // percentage gap to liquidation price
    pub position_size_ratio: f64,         // position size relative to account value
    pub risk_score: f64,                  // 0-100 composite risk rating per position
    pub contribution_to_portfolio: f64,   // how much this position contributes to overall portfolio risk
}

/// Risk warning with details about the violated threshold
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskWarning {
    pub warning_type: RiskWarningType,
    pub severity: RiskSeverity,
    pub message: String,
    pub suggested_action: String,
    pub related_position: Option<String>, // The coin name of the related position, if applicable
}

/// Types of risk warnings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RiskWarningType {
    HighLeverage,
    LiquidationRisk,
    PositionSizeExceeded,
    HighConcentration,
    MarginUtilizationHigh,
    MaxDrawdownExceeded,
    OverallPortfolioRisk,
}

/// Risk warning severity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Ord, PartialOrd, Eq)]
pub enum RiskSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// A log entry for storing risk data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: u64,
    pub positions: Vec<Position>,
    pub portfolio_metrics: PortfolioMetrics,
    pub position_metrics: Vec<PositionMetrics>,
    pub warnings: Vec<RiskWarning>,
}

impl LogEntry {
    pub fn new(
        positions: Vec<Position>,
        portfolio_metrics: PortfolioMetrics,
        position_metrics: Vec<PositionMetrics>,
        warnings: Vec<RiskWarning>,
    ) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        
        Self {
            timestamp,
            positions,
            portfolio_metrics,
            position_metrics,
            warnings,
        }
    }
}

/// Complete risk analysis results
#[derive(Debug, Clone)]
pub struct RiskAnalysisResult {
    pub positions: Vec<Position>,
    pub portfolio_metrics: PortfolioMetrics,
    pub position_metrics: Vec<PositionMetrics>,
    pub warnings: Vec<RiskWarning>,
}

/// Simplified risk summary
#[derive(Debug, Clone)]
pub struct RiskSummary {
    pub portfolio_heat: f64,
    pub highest_risk_position: Option<(Position, f64)>,
    pub warning_count: usize,
    pub margin_utilization: f64,
} 