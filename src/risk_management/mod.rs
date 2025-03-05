mod position_tracking;
mod risk_calculation;
mod data_logging;
mod risk_limits;
mod types;
mod config;

pub use position_tracking::*;
pub use risk_calculation::*;
pub use data_logging::*;
pub use risk_limits::*;
pub use types::*;
pub use config::*;

use crate::prelude::*;

/// Main Risk Management System interface that brings together all components
pub struct RiskManagementSystem {
    position_tracker: PositionTracker,
    risk_calculator: RiskCalculator,
    data_logger: DataLogger,
    risk_limiter: RiskLimiter,
}

impl RiskManagementSystem {
    /// Creates a new Risk Management System with the provided configuration
    pub async fn new(config: RiskConfig) -> Result<Self> {
        let position_tracker = PositionTracker::new(config.clone()).await?;
        let risk_calculator = RiskCalculator::new(config.clone());
        let data_logger = DataLogger::new(config.clone());
        let risk_limiter = RiskLimiter::new(config.clone());

        Ok(Self {
            position_tracker,
            risk_calculator,
            data_logger,
            risk_limiter,
        })
    }

    /// Gets the current configuration
    pub fn get_config(&self) -> RiskConfig {
        self.position_tracker.config.clone()
    }
    
    /// Updates the system with new user settings
    pub fn update_settings(&mut self, settings: UserSettings) -> Result<()> {
        // Update the configuration in each component
        let mut config = self.position_tracker.config.clone();
        config.update_from_settings(settings)?;
        
        self.position_tracker.update_config(config.clone());
        self.risk_calculator.update_config(config.clone());
        self.risk_limiter.update_config(config.clone());
        self.data_logger.update_config(config);
        
        Ok(())
    }

    /// Performs a full analysis of the current risk profile, calculating all metrics
    pub async fn analyze_risk_profile(&mut self) -> Result<RiskAnalysisResult> {
        // Get current positions
        let positions = self.position_tracker.get_current_positions().await?;
        
        // Get account summary
        let account_summary = self.position_tracker.get_account_summary().await?;
        
        // Calculate risk metrics
        let portfolio_metrics = self.risk_calculator.calculate_portfolio_metrics(&positions, &account_summary)?;
        let position_metrics = self.risk_calculator.calculate_position_metrics(&positions, &account_summary)?;
        
        // Check risk limits
        let warnings = self.risk_limiter.check_thresholds(&portfolio_metrics, &position_metrics)?;
        
        // Log the data
        self.data_logger.log_metrics(&positions, &portfolio_metrics, &position_metrics, &warnings)?;
        
        // Return the complete analysis
        Ok(RiskAnalysisResult {
            positions,
            portfolio_metrics,
            position_metrics,
            warnings,
        })
    }

    /// Provides a simple summary of the current risk status
    pub async fn get_risk_summary(&mut self) -> Result<RiskSummary> {
        let analysis = self.analyze_risk_profile().await?;
        
        Ok(RiskSummary {
            portfolio_heat: analysis.portfolio_metrics.portfolio_heat,
            highest_risk_position: analysis.position_metrics.iter()
                .max_by(|a, b| a.risk_score.partial_cmp(&b.risk_score).unwrap_or(std::cmp::Ordering::Equal))
                .map(|p| (p.position.clone(), p.risk_score)),
            warning_count: analysis.warnings.len(),
            margin_utilization: analysis.portfolio_metrics.margin_utilization,
            account_value: analysis.portfolio_metrics.account_value,
        })
    }
} 