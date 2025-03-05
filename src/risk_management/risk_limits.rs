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
            if position.leverage > max_leverage * 0.8 {
                let severity = if position.leverage >= max_leverage {
                    RiskSeverity::High
                } else {
                    RiskSeverity::Medium
                };
                
                warnings.push(RiskWarning {
                    warning_type: RiskWarningType::HighLeverage,
                    severity,
                    message: format!(
                        "{}: Leverage is high at {:.2}x (threshold: {:.2}x)",
                        position.coin, position.leverage, max_leverage
                    ),
                    suggested_action: format!(
                        "Consider reducing leverage for {} position.",
                        position.coin
                    ),
                    related_position: Some(position.coin.clone()),
                });
            }
            
            // Check distance to liquidation
            let min_distance = self.config.risk_limits.min_distance_to_liq;
            if metrics.distance_to_liquidation < min_distance {
                let severity = if metrics.distance_to_liquidation < min_distance * 0.5 {
                    RiskSeverity::Critical
                } else if metrics.distance_to_liquidation < min_distance * 0.7 {
                    RiskSeverity::High
                } else {
                    RiskSeverity::Medium
                };
                
                warnings.push(RiskWarning {
                    warning_type: RiskWarningType::LiquidationRisk,
                    severity,
                    message: format!(
                        "{}: Close to liquidation at {:.2}% distance (threshold: {:.2}%)",
                        position.coin, metrics.distance_to_liquidation, min_distance
                    ),
                    suggested_action: format!(
                        "Urgently reduce position size or add margin to the {} position.",
                        position.coin
                    ),
                    related_position: Some(position.coin.clone()),
                });
            }
            
            // Check position size
            let max_position_pct = self.config.risk_limits.max_position_pct;
            if metrics.position_size_ratio > max_position_pct {
                warnings.push(RiskWarning {
                    warning_type: RiskWarningType::PositionSizeExceeded,
                    severity: RiskSeverity::Medium,
                    message: format!(
                        "{}: Position size is {:.2}% of portfolio (threshold: {:.2}%)",
                        position.coin, metrics.position_size_ratio, max_position_pct
                    ),
                    suggested_action: format!(
                        "Consider reducing the size of the {} position to improve diversification.",
                        position.coin
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