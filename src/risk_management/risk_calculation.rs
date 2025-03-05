use crate::prelude::*;
use crate::risk_management::{Position, PortfolioMetrics, PositionMetrics, RiskConfig, AccountSummary};

/// Risk calculation engine for assessing position and portfolio risks
pub struct RiskCalculator {
    config: RiskConfig,
}

impl RiskCalculator {
    /// Creates a new risk calculator with the provided configuration
    pub fn new(config: RiskConfig) -> Self {
        Self { config }
    }
    
    /// Updates the configuration
    pub fn update_config(&mut self, config: RiskConfig) {
        self.config = config;
    }
    
    /// Calculates portfolio-level risk metrics
    pub fn calculate_portfolio_metrics(&self, positions: &[Position], account_summary: &AccountSummary) -> Result<PortfolioMetrics> {
        if positions.is_empty() {
            return Ok(PortfolioMetrics {
                portfolio_heat: 0.0,
                concentration_score: 0.0,
                risk_adjusted_return: 0.0,
                margin_utilization: 0.0,
                total_unrealized_pnl: 0.0,
                account_value: account_summary.account_value,
                total_position_value: 0.0,
                average_leverage: 0.0,
            });
        }
        
        // Calculate total values
        let total_position_value: f64 = positions.iter().map(|p| p.position_value.abs()).sum();
        
        // Separate cross and isolated positions for margin calculations
        let cross_positions: Vec<&Position> = positions.iter().filter(|p| p.is_cross).collect();
        let isolated_positions: Vec<&Position> = positions.iter().filter(|p| !p.is_cross).collect();
        
        // Calculate margin used for cross positions
        let cross_margin_used: f64 = cross_positions.iter().map(|p| p.margin_used).sum();
        
        // For isolated positions, each position's margin is independent
        let isolated_margin_used: f64 = isolated_positions.iter().map(|p| p.margin_used).sum();
        
        // Total margin used is the sum of cross and isolated margins
        let total_margin_used: f64 = cross_margin_used + isolated_margin_used;
        
        let total_unrealized_pnl: f64 = positions.iter().map(|p| p.unrealized_pnl).sum();
        
        // Use the account value from the account summary
        let account_value = account_summary.account_value;
        
        // Calculate margin utilization
        let margin_utilization = if account_value > 0.0 {
            (total_margin_used / account_value) * 100.0
        } else {
            0.0
        };
        
        // Calculate average leverage (weighted by position size)
        // For cross positions, use the standard calculation
        let cross_weighted_leverage_sum: f64 = cross_positions.iter()
            .map(|p| p.leverage * p.position_value.abs())
            .sum();
        
        // We don't need this variable since we're using total_position_value
        // Prefix with underscore to indicate it's intentionally unused
        let _cross_position_value: f64 = cross_positions.iter().map(|p| p.position_value.abs()).sum();
        
        // For isolated positions, calculate separately
        let isolated_weighted_leverage_sum: f64 = isolated_positions.iter()
            .map(|p| p.leverage * p.position_value.abs())
            .sum();
        
        // We don't need this variable since we're using total_position_value
        // Prefix with underscore to indicate it's intentionally unused
        let _isolated_position_value: f64 = isolated_positions.iter().map(|p| p.position_value.abs()).sum();
        
        // Combine for weighted average leverage
        let average_leverage = if total_position_value > 0.0 {
            (cross_weighted_leverage_sum + isolated_weighted_leverage_sum) / total_position_value
        } else {
            0.0
        };
        
        // Calculate concentration score (0-100, higher means more concentrated)
        let concentration_score = self.calculate_concentration_score(positions);
        
        // Calculate portfolio heat (0-100, higher means more risky)
        let portfolio_heat = self.calculate_portfolio_heat(
            positions, 
            margin_utilization, 
            average_leverage, 
            concentration_score
        );
        
        // Calculate risk-adjusted return
        let total_return: f64 = positions.iter()
            .map(|p| p.return_on_equity * p.position_value.abs())
            .sum();
        
        let risk_adjusted_return = if total_position_value > 0.0 && portfolio_heat > 0.0 {
            (total_return / total_position_value) / (portfolio_heat / 50.0) // Normalize to a reasonable scale
        } else {
            0.0
        };
        
        Ok(PortfolioMetrics {
            portfolio_heat,
            concentration_score,
            risk_adjusted_return,
            margin_utilization,
            total_unrealized_pnl,
            account_value,
            total_position_value,
            average_leverage,
        })
    }
    
    /// Calculates position-level risk metrics for each position
    pub fn calculate_position_metrics(&self, positions: &[Position], account_summary: &AccountSummary) -> Result<Vec<PositionMetrics>> {
        if positions.is_empty() {
            return Ok(Vec::new());
        }
        
        // Calculate total position value for relative calculations
        let total_position_value: f64 = positions.iter().map(|p| p.position_value.abs()).sum();
        
        // Get account value for position size ratio calculations
        let account_value = account_summary.account_value;
        
        // Calculate metrics for each position
        let mut position_metrics = Vec::with_capacity(positions.len());
        
        for position in positions {
            // Calculate distance to liquidation
            let distance_to_liquidation = self.calculate_distance_to_liquidation(position);
            
            // Calculate position size ratio relative to account value
            let position_size_ratio = if account_value > 0.0 {
                (position.margin_used / account_value) * 100.0
            } else {
                0.0
            };
            
            // Calculate overall risk score for the position (0-100)
            let risk_score = self.calculate_position_risk_score(
                position,
                distance_to_liquidation,
                position_size_ratio
            );
            
            // Calculate position's contribution to overall portfolio risk
            let contribution_to_portfolio = if total_position_value > 0.0 {
                (position.position_value.abs() / total_position_value) * risk_score
            } else {
                0.0
            };
            
            position_metrics.push(PositionMetrics {
                position: position.clone(),
                distance_to_liquidation,
                position_size_ratio,
                risk_score,
                contribution_to_portfolio,
            });
        }
        
        Ok(position_metrics)
    }
    
    /// Calculates the distance to liquidation as a percentage
    fn calculate_distance_to_liquidation(&self, position: &Position) -> f64 {
        // If position size is 0 or there's no liquidation price, return a large value
        if position.size.abs() < f64::EPSILON || position.liquidation_price.is_none() || position.entry_price.is_none() {
            return 100.0;
        }
        
        let entry_price = position.entry_price.unwrap();
        let liquidation_price = position.liquidation_price.unwrap();
        
        // Calculate the distance based on the position direction
        let distance = if position.size > 0.0 {
            // Long position - liquidation price is below entry
            if liquidation_price < entry_price {
                ((entry_price - liquidation_price) / entry_price) * 100.0
            } else {
                // Unexpected case, return a high value
                100.0
            }
        } else {
            // Short position - liquidation price is above entry
            if liquidation_price > entry_price {
                ((liquidation_price - entry_price) / entry_price) * 100.0
            } else {
                // Unexpected case, return a high value
                100.0
            }
        };
        
        distance
    }
    
    /// Calculates a risk score (0-100) for a position
    fn calculate_position_risk_score(
        &self, 
        position: &Position,
        distance_to_liquidation: f64,
        position_size_ratio: f64,
    ) -> f64 {
        // Leverage component (0-40 points)
        // For isolated margin, leverage risk is higher since it can't use margin from other positions
        let max_leverage = self.config.risk_limits.max_leverage;
        let leverage_factor = if position.is_cross {
            // Cross margin positions have slightly lower risk
            (position.leverage / max_leverage) * 35.0
        } else {
            // Isolated margin positions have higher risk
            (position.leverage / max_leverage) * 40.0
        };
        
        // Liquidation distance component (0-40 points)
        // Smaller distance = higher risk
        // For isolated margin, liquidation risk is more localized
        let min_distance = self.config.risk_limits.min_distance_to_liq;
        let distance_factor = if distance_to_liquidation < min_distance {
            if position.is_cross {
                // Cross margin has more buffer before liquidation
                35.0 * (1.0 - (distance_to_liquidation / min_distance))
            } else {
                // Isolated margin has higher liquidation risk
                40.0 * (1.0 - (distance_to_liquidation / min_distance))
            }
        } else {
            0.0
        };
        
        // Position size component (0-20 points for cross, 0-25 for isolated)
        let max_position_pct = self.config.risk_limits.max_position_pct;
        let size_factor = if position.is_cross {
            (position_size_ratio / max_position_pct) * 20.0
        } else {
            (position_size_ratio / max_position_pct) * 25.0
        };
        
        // Sum all factors and cap at 100
        let score = leverage_factor + distance_factor + size_factor;
        score.min(100.0).max(0.0)
    }
    
    /// Calculates concentration score based on position distribution
    fn calculate_concentration_score(&self, positions: &[Position]) -> f64 {
        if positions.len() <= 1 {
            return 100.0; // Maximum concentration if only one position
        }
        
        // Calculate total position value
        let total_position_value: f64 = positions.iter().map(|p| p.position_value.abs()).sum();
        
        if total_position_value <= 0.0 {
            return 0.0;
        }
        
        // Calculate normalized Herfindahl-Hirschman Index (HHI)
        // HHI measures market concentration
        let mut sum_squared_shares = 0.0;
        
        for position in positions {
            let market_share = position.position_value.abs() / total_position_value;
            sum_squared_shares += market_share * market_share;
        }
        
        // Normalize to 0-100 scale
        // For a perfectly equal distribution, HHI = 1/N (where N is number of positions)
        // For maximum concentration, HHI = 1
        // Normalize to make 1/N -> 0 and 1 -> 100
        let min_hhi = 1.0 / positions.len() as f64;
        let normalized_score = ((sum_squared_shares - min_hhi) / (1.0 - min_hhi)) * 100.0;
        
        normalized_score.min(100.0).max(0.0)
    }
    
    /// Calculates portfolio heat based on multiple risk factors
    fn calculate_portfolio_heat(
        &self,
        positions: &[Position],
        margin_utilization: f64,
        _average_leverage: f64, // Prefix with underscore since we're not using it anymore
        concentration_score: f64,
    ) -> f64 {
        // Separate cross and isolated positions
        let cross_positions: Vec<&Position> = positions.iter().filter(|p| p.is_cross).collect();
        let isolated_positions: Vec<&Position> = positions.iter().filter(|p| !p.is_cross).collect();
        
        // Calculate total position values for weighting
        let total_position_value: f64 = positions.iter().map(|p| p.position_value.abs()).sum();
        let cross_position_value: f64 = cross_positions.iter().map(|p| p.position_value.abs()).sum();
        let isolated_position_value: f64 = isolated_positions.iter().map(|p| p.position_value.abs()).sum();
        
        // Leverage component (0-30 points)
        let max_leverage = self.config.risk_limits.max_leverage;
        
        // Calculate weighted leverage factor based on position types
        let cross_leverage_factor = if cross_position_value > 0.0 {
            let cross_avg_leverage = cross_positions.iter()
                .map(|p| p.leverage * p.position_value.abs())
                .sum::<f64>() / cross_position_value;
            
            (cross_avg_leverage / max_leverage) * 25.0 * (cross_position_value / total_position_value)
        } else {
            0.0
        };
        
        let isolated_leverage_factor = if isolated_position_value > 0.0 {
            let isolated_avg_leverage = isolated_positions.iter()
                .map(|p| p.leverage * p.position_value.abs())
                .sum::<f64>() / isolated_position_value;
            
            (isolated_avg_leverage / max_leverage) * 30.0 * (isolated_position_value / total_position_value)
        } else {
            0.0
        };
        
        let leverage_factor = cross_leverage_factor + isolated_leverage_factor;
        
        // Margin utilization component (0-40 points)
        let max_margin = self.config.risk_limits.max_margin_utilization;
        let margin_factor = (margin_utilization / max_margin) * 40.0;
        
        // Concentration component (0-20 points)
        let concentration_factor = concentration_score * 0.2;
        
        // Liquidation risk component (0-10 points)
        // Isolated positions have higher liquidation risk
        let cross_liquidation_factor = cross_positions.iter()
            .map(|p| self.calculate_distance_to_liquidation(p))
            .filter(|&d| d < self.config.risk_limits.min_distance_to_liq)
            .map(|d| 8.0 * (1.0 - (d / self.config.risk_limits.min_distance_to_liq)))
            .sum::<f64>()
            .min(8.0) * (cross_position_value / total_position_value);
            
        let isolated_liquidation_factor = isolated_positions.iter()
            .map(|p| self.calculate_distance_to_liquidation(p))
            .filter(|&d| d < self.config.risk_limits.min_distance_to_liq)
            .map(|d| 10.0 * (1.0 - (d / self.config.risk_limits.min_distance_to_liq)))
            .sum::<f64>()
            .min(10.0) * (isolated_position_value / total_position_value);
            
        let liquidation_factor = cross_liquidation_factor + isolated_liquidation_factor;
        
        // Sum all factors and cap at 100
        let heat = leverage_factor + margin_factor + concentration_factor + liquidation_factor;
        heat.min(100.0).max(0.0)
    }
} 