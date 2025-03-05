use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;
use chrono::{DateTime, Utc};
use serde_json;
use reqwest::Client;
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE, AUTHORIZATION};

use crate::prelude::*;
use crate::Error;
use crate::risk_management::{
    LogEntry, Position, PortfolioMetrics, PositionMetrics, RiskConfig, RiskWarning
};

/// Data logging system for storing position and risk metric data
pub struct DataLogger {
    config: RiskConfig,
    log_file_path: Option<String>,
    http_client: Option<Client>,
}

impl DataLogger {
    /// Creates a new data logger with the provided configuration
    pub fn new(config: RiskConfig) -> Self {
        let log_file_path = if config.enable_logging && config.log_to_console {
            Some("hyperliquid_risk_log.jsonl".to_string())
        } else {
            None
        };
        
        // Initialize HTTP client for Supabase if needed
        let http_client = if config.log_to_database && config.database_url.is_some() && config.database_key.is_some() {
            let client = Client::new();
            Some(client)
        } else {
            None
        };
        
        Self {
            config,
            log_file_path,
            http_client,
        }
    }
    
    /// Logs position and risk metrics data
    pub fn log_metrics(
        &self,
        positions: &[Position],
        portfolio_metrics: &PortfolioMetrics,
        position_metrics: &[PositionMetrics],
        warnings: &[RiskWarning],
    ) -> Result<()> {
        if !self.config.enable_logging {
            return Ok(());
        }
        
        // Create a log entry
        let log_entry = LogEntry::new(
            positions.to_vec(),
            portfolio_metrics.clone(),
            position_metrics.to_vec(),
            warnings.to_vec(),
        );
        
        // Log to console if enabled
        if self.config.log_to_console {
            self.log_to_console(&log_entry)?;
        }
        
        // Log to file if enabled
        if let Some(ref path) = self.log_file_path {
            self.log_to_file(path, &log_entry)?;
        }
        
        // Log to database if enabled
        if self.config.log_to_database && self.config.database_url.is_some() && self.config.database_key.is_some() {
            self.log_to_database(&log_entry)?;
        }
        
        Ok(())
    }
    
    /// Logs data to the console
    fn log_to_console(&self, log_entry: &LogEntry) -> Result<()> {
        // Format timestamp
        let datetime: DateTime<Utc> = DateTime::from_timestamp(log_entry.timestamp as i64, 0)
            .unwrap_or_else(|| Utc::now());
        
        println!("========== HYPERLIQUID RISK REPORT ==========");
        println!("Time: {}", datetime.format("%Y-%m-%d %H:%M:%S UTC"));
        println!("=============================================");
        
        // Portfolio metrics summary
        println!("PORTFOLIO METRICS:");
        println!("  Portfolio Heat:       {:.2}%", log_entry.portfolio_metrics.portfolio_heat);
        println!("  Margin Utilization:   {:.2}%", log_entry.portfolio_metrics.margin_utilization);
        println!("  Concentration Score:  {:.2}", log_entry.portfolio_metrics.concentration_score);
        println!("  Risk Adjusted Return: {:.2}", log_entry.portfolio_metrics.risk_adjusted_return);
        println!("  Account Value:        ${:.2}", log_entry.portfolio_metrics.account_value);
        println!("  Unrealized PnL:       ${:.2}", log_entry.portfolio_metrics.total_unrealized_pnl);
        println!("  Average Leverage:     {:.2}x", log_entry.portfolio_metrics.average_leverage);
        println!();
        
        // Position details
        if !log_entry.position_metrics.is_empty() {
            println!("POSITIONS:");
            println!("{:<10} {:<10} {:<10} {:<10} {:<10} {:<10}", 
                     "COIN", "SIZE", "LEV", "RISK", "LIQ DIST", "PNL");
            
            for metrics in &log_entry.position_metrics {
                let pos = &metrics.position;
                println!("{:<10} {:<10.2} {:<10.1}x {:<10.1} {:<10.2}% ${:<10.2}", 
                         pos.coin,
                         pos.size,
                         pos.leverage,
                         metrics.risk_score,
                         metrics.distance_to_liquidation,
                         pos.unrealized_pnl);
            }
            println!();
        }
        
        // Risk warnings
        if !log_entry.warnings.is_empty() {
            println!("RISK WARNINGS:");
            for warning in &log_entry.warnings {
                let severity = format!("[{:?}]", warning.severity);
                println!("{:<10} {}", severity, warning.message);
                println!("  Suggested Action: {}", warning.suggested_action);
            }
            println!();
        }
        
        println!("=============================================");
        
        Ok(())
    }
    
    /// Logs data to a JSON Lines file
    fn log_to_file(&self, path: &str, log_entry: &LogEntry) -> Result<()> {
        let path = Path::new(path);
        let _file_exists = path.exists();
        
        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .append(true)
            .open(path)
            .map_err(|e| Error::Custom(format!("Failed to open log file: {}", e)))?;
        
        let json_line = serde_json::to_string(&log_entry)
            .map_err(|e| Error::Custom(format!("Failed to serialize log entry: {}", e)))?;
        
        writeln!(file, "{}", json_line)
            .map_err(|e| Error::Custom(format!("Failed to write to log file: {}", e)))?;
        
        Ok(())
    }
    
    /// Logs data to a Supabase database
    fn log_to_database(&self, log_entry: &LogEntry) -> Result<()> {
        // Check if we have the required database configuration
        let db_url = match &self.config.database_url {
            Some(url) => url.clone(),
            None => return Err(Error::Custom("Supabase URL not configured".to_string()))
        };
        
        let api_key = match &self.config.database_key {
            Some(key) => key.clone(),
            None => return Err(Error::Custom("Supabase API key not configured".to_string()))
        };
        
        // Check if we have an HTTP client
        let client = match &self.http_client {
            Some(client) => client.clone(),
            None => return Err(Error::Custom("HTTP client not initialized".to_string()))
        };
        
        // Create the Supabase REST API endpoint URL for the 'risk_logs' table
        // Make sure there's no trailing slash in the URL
        let base_url = db_url.trim_end_matches('/').to_string();
        
        // Try different table names that might exist in the database
        // First try 'risk_logs' (our preferred table name)
        let endpoint = format!("{}/rest/v1/risk_logs", base_url);
        
        // Log the endpoint for troubleshooting
        log::info!("Using Supabase endpoint: {}", endpoint);
        
        // Serialize the log entry to JSON
        let body = match serde_json::to_string(&log_entry) {
            Ok(json) => json,
            Err(e) => return Err(Error::Custom(format!("Failed to serialize log entry: {}", e)))
        };
        
        // Capture the body length before moving the body
        let body_len = body.len();
        
        // Set up headers for Supabase
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", api_key))
            .map_err(|e| Error::Custom(format!("Invalid API key format: {}", e)))?);
        headers.insert("apikey", HeaderValue::from_str(&api_key)
            .map_err(|e| Error::Custom(format!("Invalid API key format: {}", e)))?);
        // Add the Prefer header for upsert behavior
        headers.insert("Prefer", HeaderValue::from_static("return=minimal"));
        
        // Log headers for debugging (excluding sensitive information)
        log::info!("Request headers: Content-Type: {}, Authorization: Bearer *****, apikey: *****, Prefer: return=minimal", 
                  headers.get(CONTENT_TYPE).unwrap().to_str().unwrap_or("unknown"));
        
        // First, check if the table exists by making a GET request
        let table_check_endpoint = format!("{}/rest/v1/risk_logs?limit=1", base_url);
        let headers_clone = headers.clone();
        let client_clone = client.clone();
        let endpoint_clone = endpoint.clone();
        let base_url_clone = base_url.clone();
        
        // Send the request asynchronously using tokio's runtime
        tokio::spawn(async move {
            // First check if the table exists
            match client_clone.get(&table_check_endpoint)
                .headers(headers_clone)
                .send()
                .await {
                Ok(check_response) => {
                    if check_response.status() == reqwest::StatusCode::NOT_FOUND {
                        // Table doesn't exist, try to create it or use an alternative table
                        log::error!("Table 'risk_logs' not found. Please create the table using the SQL script in supabase_setup.sql");
                        
                        // Try alternative tables that might exist
                        let alternative_tables = ["risk_data", "trading_risk", "position_logs"];
                        
                        for table in alternative_tables.iter() {
                            let alt_endpoint = format!("{}/rest/v1/{}", base_url_clone, table);
                            log::info!("Trying alternative table: {}", table);
                            
                            // Try to insert into the alternative table
                            if let Ok(alt_response) = client.post(&alt_endpoint)
                                .headers(headers.clone())
                                .body(body.clone())
                                .send()
                                .await {
                                if alt_response.status().is_success() {
                                    log::info!("Successfully logged to alternative table: {}", table);
                                    return;
                                }
                            }
                        }
                        
                        log::error!("Could not find any suitable tables for logging. Please create the 'risk_logs' table.");
                    } else {
                        // Table exists, proceed with the insert
                        match client.post(&endpoint_clone)
                            .headers(headers)
                            .body(body)
                            .send()
                            .await {
                            Ok(response) => {
                                if !response.status().is_success() {
                                    let status = response.status();
                                    if let Ok(error_text) = response.text().await {
                                        log::error!("Failed to log to database. Status: {}, Error: {}", 
                                                   status, error_text);
                                        // More detailed error logging for troubleshooting
                                        log::error!("Request URL: {}", endpoint_clone);
                                        log::error!("Request body length: {} bytes", body_len);
                                    } else {
                                        log::error!("Failed to log to database. Status: {}", status);
                                        log::error!("Request URL: {}", endpoint_clone);
                                    }
                                } else {
                                    log::info!("Successfully logged entry to Supabase database");
                                }
                            },
                            Err(e) => {
                                log::error!("Failed to send request to database: {}", e);
                            }
                        }
                    }
                },
                Err(e) => {
                    log::error!("Failed to check if table exists: {}", e);
                    log::error!("Check URL: {}", table_check_endpoint);
                }
            }
        });
        
        log::info!("Sent log entry to Supabase database at timestamp: {}", log_entry.timestamp);
        
        Ok(())
    }
} 