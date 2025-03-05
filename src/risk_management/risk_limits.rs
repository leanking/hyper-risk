use crate::prelude::*;
use crate::risk_management::{
    PortfolioMetrics, PositionMetrics, RiskConfig, RiskWarning, RiskWarningType, RiskSeverity
};

/// Risk limits and warnings system for enforcing risk management boundaries
pub struct RiskLimiter {
    config: RiskConfig,
}

impl RiskLimiter {
    /// Creates a new risk limiter with the provided configuration
    pub fn new(config: RiskConfig) -> Self {
        Self { config }
    }
    
    /// Checks risk metrics against thresholds and generates warnings
    pub fn check_thresholds(
        &self,
        portfolio_metrics: &PortfolioMetrics,
        position_metrics: &[PositionMetrics],
    ) -> Result<Vec<RiskWarning>> {
        let mut warnings = Vec::new();
        
        // Check portfolio-level thresholds
        self.check_portfolio_thresholds(portfolio_metrics, &mut warnings);
        
        // Check position-level thresholds
        self.check_position_thresholds(position_metrics, &mut warnings);
        
        // Sort warnings by severity (highest first)
        warnings.sort_by(|a, b| b.severity.cmp(&a.severity));
        
        Ok(warnings)
    }
    
    /// Checks portfolio-level risk metrics against thresholds
    fn check_portfolio_thresholds(
        &self,
        metrics: &PortfolioMetrics,
        warnings: &mut Vec<RiskWarning>,
    ) {
        // Check margin utilization
        let max_margin = self.config.risk_limits.max_margin_utilization;
        if metrics.margin_utilization > max_margin * 0.9 {
            let severity = if metrics.margin_utilization >= max_margin {
                RiskSeverity::Critical
            } else if metrics.margin_utilization >= max_margin * 0.95 {
                RiskSeverity::High
            } else {
                RiskSeverity::Medium
            };
            
            warnings.push(RiskWarning {
                warning_type: RiskWarningType::MarginUtilizationHigh,
                severity,
                message: format!(
                    "Margin utilization is high at {:.2}% (threshold: {:.2}%)",
                    metrics.margin_utilization, max_margin
                ),
                suggested_action: "Consider reducing position sizes or adding more collateral.".to_string(),
                related_position: None,
            });
        }
        
        // Check portfolio heat
        if metrics.portfolio_heat > 70.0 {
            let severity = if metrics.portfolio_heat >= 90.0 {
                RiskSeverity::Critical
            } else if metrics.portfolio_heat >= 80.0 {
                RiskSeverity::High
            } else {
                RiskSeverity::Medium
            };
            
            warnings.push(RiskWarning {
                warning_type: RiskWarningType::OverallPortfolioRisk,
                severity,
                message: format!(
                    "Overall portfolio risk is high with a heat score of {:.2}",
                    metrics.portfolio_heat
                ),
                suggested_action: "Reduce leverage or diversify positions to lower overall risk.".to_string(),
                related_position: None,
            });
        }
        
        // Check concentration
        if metrics.concentration_score > 80.0 && metrics.total_position_value > 0.0 {
            warnings.push(RiskWarning {
                warning_type: RiskWarningType::HighConcentration,
                severity: RiskSeverity::Medium,
                message: format!(
                    "Portfolio is highly concentrated with a score of {:.2}",
                    metrics.concentration_score
                ),
                suggested_action: "Consider diversifying your positions across more assets.".to_string(),
                related_position: None,
            });
        }
        
        // Check average leverage
        let max_leverage = self.config.risk_limits.max_leverage;
        if metrics.average_leverage > max_leverage * 0.8 {
            let severity = if metrics.average_leverage >= max_leverage {
                RiskSeverity::High
            } else {
                RiskSeverity::Medium
            };
            
            warnings.push(RiskWarning {
                warning_type: RiskWarningType::HighLeverage,
                severity,
                message: format!(
                    "Average portfolio leverage is high at {:.2}x (threshold: {:.2}x)",
                    metrics.average_leverage, max_leverage
                ),
                suggested_action: "Consider reducing leverage to minimize liquidation risk.".to_string(),
                related_position: None,
            });
        }
    }
    
    /// Checks position-level risk metrics against thresholds
    fn check_position_thresholds(
        &self,
        position_metrics: &[PositionMetrics],
        warnings: &mut Vec<RiskWarning>,
    ) {
        for metrics in position_metrics {
            let position = &metrics.position;
            
            // Check leverage
            let max_leverage = self.config.risk_limits.max_leverage;
            // For isolated margin, we apply stricter leverage checks
            let leverage_threshold = if position.is_cross {
                max_leverage * 0.8
            } else {
                max_leverage * 0.7 // Stricter threshold for isolated positions
            };
            
            if position.leverage > leverage_threshold {
                let severity = if position.leverage >= max_leverage {
                    RiskSeverity::High
                } else if !position.is_cross && position.leverage >= max_leverage * 0.9 {
                    // Higher severity for isolated positions approaching max leverage
                    RiskSeverity::High
                } else {
                    RiskSeverity::Medium
                };
                
                let margin_type = if position.is_cross { "cross" } else { "isolated" };
                
                warnings.push(RiskWarning {
                    warning_type: RiskWarningType::HighLeverage,
                    severity,
                    message: format!(
                        "{}: {} margin leverage is high at {:.2}x (threshold: {:.2}x)",
                        position.coin, margin_type, position.leverage, max_leverage
                    ),
                    suggested_action: format!(
                        "Consider reducing leverage for {} position or switching to {} margin.",
                        position.coin, if position.is_cross { "lower" } else { "cross" }
                    ),
                    related_position: Some(position.coin.clone()),
                });
            }
            
            // Check distance to liquidation
            let min_distance = self.config.risk_limits.min_distance_to_liq;
            // For isolated margin, we need a larger buffer to liquidation
            let distance_threshold = if position.is_cross {
                min_distance
            } else {
                min_distance * 1.5 // Higher threshold for isolated positions
            };
            
            if metrics.distance_to_liquidation < distance_threshold {
                let severity = if metrics.distance_to_liquidation < min_distance * 0.5 {
                    RiskSeverity::Critical
                } else if metrics.distance_to_liquidation < min_distance * 0.7 {
                    RiskSeverity::High
                } else if !position.is_cross && metrics.distance_to_liquidation < min_distance {
                    // Higher severity for isolated positions
                    RiskSeverity::High
                } else {
                    RiskSeverity::Medium
                };
                
                let margin_type = if position.is_cross { "cross" } else { "isolated" };
                
                warnings.push(RiskWarning {
                    warning_type: RiskWarningType::LiquidationRisk,
                    severity,
                    message: format!(
                        "{}: {} margin position close to liquidation at {:.2}% distance (threshold: {:.2}%)",
                        position.coin, margin_type, metrics.distance_to_liquidation, distance_threshold
                    ),
                    suggested_action: format!(
                        "Urgently reduce position size or add margin to the {} position{}.",
                        position.coin,
                        if !position.is_cross { " or consider switching to cross margin" } else { "" }
                    ),
                    related_position: Some(position.coin.clone()),
                });
            }
            
            // Check position size
            let max_position_pct = self.config.risk_limits.max_position_pct;
            // For isolated margin, we apply stricter position size limits
            let position_size_threshold = if position.is_cross {
                max_position_pct
            } else {
                max_position_pct * 0.8 // Stricter threshold for isolated positions
            };
            
            if metrics.position_size_ratio > position_size_threshold {
                let severity = if !position.is_cross && metrics.position_size_ratio > max_position_pct {
                    // Higher severity for isolated positions exceeding the normal threshold
                    RiskSeverity::High
                } else {
                    RiskSeverity::Medium
                };
                
                let margin_type = if position.is_cross { "cross" } else { "isolated" };
                
                warnings.push(RiskWarning {
                    warning_type: RiskWarningType::PositionSizeExceeded,
                    severity,
                    message: format!(
                        "{}: {} margin position uses {:.2}% of account value (threshold: {:.2}%)",
                        position.coin, margin_type, metrics.position_size_ratio, position_size_threshold
                    ),
                    suggested_action: format!(
                        "Consider reducing the size of the {} position to improve diversification{}.",
                        position.coin,
                        if !position.is_cross { " or switching to cross margin" } else { "" }
                    ),
                    related_position: Some(position.coin.clone()),
                });
            }
            
            // Check position value against USD limit
            let max_position_size_usd = self.config.risk_limits.max_position_size_usd;
            if position.position_value > max_position_size_usd {
                warnings.push(RiskWarning {
                    warning_type: RiskWarningType::PositionSizeExceeded,
                    severity: RiskSeverity::Medium,
                    message: format!(
                        "{}: Position value is ${:.2} (threshold: ${:.2})",
                        position.coin, position.position_value, max_position_size_usd
                    ),
                    suggested_action: format!(
                        "Consider reducing the size of the {} position to stay within USD limits.",
                        position.coin
                    ),
                    related_position: Some(position.coin.clone()),
                });
            }
        }
    }
} 