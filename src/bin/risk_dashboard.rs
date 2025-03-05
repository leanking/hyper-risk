use std::env;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use actix_cors::Cors;
use actix_files as fs;
use actix_web::{web, App, HttpResponse, HttpServer, Responder, Result};
use log::{info, error};
use serde_json::json;
use tokio::time;

use hyperliquid_rust_sdk::risk_management::{
    RiskManagementSystem, RiskConfig, DataLogger
};

// Shared state between threads
struct AppState {
    risk_system: Mutex<RiskManagementSystem>,
    data_logger: DataLogger,
}

// API endpoint to get the latest risk analysis
async fn get_risk_analysis(data: web::Data<Arc<AppState>>) -> Result<impl Responder> {
    let mut risk_system = data.risk_system.lock().unwrap();
    
    match risk_system.analyze_risk_profile().await {
        Ok(analysis) => {
            let response = json!({
                "positions": analysis.positions,
                "portfolio_metrics": analysis.portfolio_metrics,
                "position_metrics": analysis.position_metrics,
                "warnings": analysis.warnings,
            });
            
            Ok(HttpResponse::Ok().json(response))
        },
        Err(e) => {
            error!("Failed to get risk analysis: {}", e);
            Ok(HttpResponse::InternalServerError().json(json!({
                "error": format!("Failed to get risk analysis: {}", e)
            })))
        }
    }
}

// API endpoint to get historical data for a specific metric
async fn get_metric_history(
    data: web::Data<Arc<AppState>>,
    path: web::Path<String>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> Result<impl Responder> {
    let metric_name = path.into_inner();
    let limit = query.get("limit")
        .and_then(|l| l.parse::<usize>().ok())
        .unwrap_or(100);
    
    match data.data_logger.get_time_series_data(&metric_name, limit) {
        Ok(time_series) => {
            let response = json!({
                "metric": metric_name,
                "data": time_series.iter().map(|(ts, val)| {
                    json!({
                        "timestamp": ts,
                        "value": val
                    })
                }).collect::<Vec<_>>()
            });
            
            Ok(HttpResponse::Ok().json(response))
        },
        Err(e) => {
            error!("Failed to get metric history: {}", e);
            Ok(HttpResponse::InternalServerError().json(json!({
                "error": format!("Failed to get metric history: {}", e)
            })))
        }
    }
}

// API endpoint to get historical data for a specific position
async fn get_position_history(
    data: web::Data<Arc<AppState>>,
    path: web::Path<(String, String)>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> Result<impl Responder> {
    let (coin, metric_name) = path.into_inner();
    let limit = query.get("limit")
        .and_then(|l| l.parse::<usize>().ok())
        .unwrap_or(100);
    
    match data.data_logger.get_position_time_series(&coin, &metric_name, limit) {
        Ok(time_series) => {
            let response = json!({
                "coin": coin,
                "metric": metric_name,
                "data": time_series.iter().map(|(ts, val)| {
                    json!({
                        "timestamp": ts,
                        "value": val
                    })
                }).collect::<Vec<_>>()
            });
            
            Ok(HttpResponse::Ok().json(response))
        },
        Err(e) => {
            error!("Failed to get position history: {}", e);
            Ok(HttpResponse::InternalServerError().json(json!({
                "error": format!("Failed to get position history: {}", e)
            })))
        }
    }
}

// API endpoint to get a list of all available positions
async fn get_positions(data: web::Data<Arc<AppState>>) -> Result<impl Responder> {
    // Get the latest analysis from the data logger
    match data.data_logger.get_historical_data(1) {
        Ok(entries) => {
            if let Some(entry) = entries.first() {
                let positions: Vec<String> = entry.positions.iter()
                    .map(|p| p.coin.clone())
                    .collect();
                
                Ok(HttpResponse::Ok().json(json!({
                    "positions": positions
                })))
            } else {
                Ok(HttpResponse::Ok().json(json!({
                    "positions": Vec::<String>::new()
                })))
            }
        },
        Err(e) => {
            error!("Failed to get positions: {}", e);
            Ok(HttpResponse::InternalServerError().json(json!({
                "error": format!("Failed to get positions: {}", e)
            })))
        }
    }
}

// API endpoint to get a summary of the current risk status
async fn get_risk_summary(data: web::Data<Arc<AppState>>) -> Result<impl Responder> {
    let mut risk_system = data.risk_system.lock().unwrap();
    
    match risk_system.get_risk_summary().await {
        Ok(summary) => {
            let highest_risk = summary.highest_risk_position.clone().map(|(pos, score)| {
                json!({
                    "coin": pos.coin,
                    "risk_score": score
                })
            });
            
            let response = json!({
                "portfolio_heat": summary.portfolio_heat,
                "highest_risk_position": highest_risk,
                "warning_count": summary.warning_count,
                "margin_utilization": summary.margin_utilization,
                "account_value": summary.account_value
            });
            
            Ok(HttpResponse::Ok().json(response))
        },
        Err(e) => {
            error!("Failed to get risk summary: {}", e);
            Ok(HttpResponse::InternalServerError().json(json!({
                "error": format!("Failed to get risk summary: {}", e)
            })))
        }
    }
}

// API endpoint to get the current settings
async fn get_settings(data: web::Data<Arc<AppState>>) -> Result<impl Responder> {
    let risk_system = data.risk_system.lock().unwrap();
    let settings = risk_system.get_config().get_user_settings();
    
    Ok(HttpResponse::Ok().json(settings))
}

// API endpoint to update settings
async fn update_settings(
    data: web::Data<Arc<AppState>>,
    settings: web::Json<hyperliquid_rust_sdk::risk_management::UserSettings>,
) -> Result<impl Responder> {
    let mut risk_system = data.risk_system.lock().unwrap();
    
    match risk_system.update_settings(settings.into_inner()) {
        Ok(_) => {
            Ok(HttpResponse::Ok().json(json!({
                "status": "success",
                "message": "Settings updated successfully"
            })))
        },
        Err(e) => {
            error!("Failed to update settings: {}", e);
            Ok(HttpResponse::InternalServerError().json(json!({
                "error": format!("Failed to update settings: {}", e)
            })))
        }
    }
}

// Debug endpoint to check what's happening with the risk summary
async fn debug_risk_summary(data: web::Data<Arc<AppState>>) -> Result<impl Responder> {
    let mut risk_system = data.risk_system.lock().unwrap();
    
    match risk_system.get_risk_summary().await {
        Ok(summary) => {
            // Log the summary for debugging
            info!("Debug risk summary: {:?}", &summary);
            
            let highest_risk = summary.highest_risk_position.clone().map(|(pos, score)| {
                json!({
                    "coin": pos.coin,
                    "risk_score": score
                })
            });
            
            let response = json!({
                "portfolio_heat": summary.portfolio_heat,
                "highest_risk_position": highest_risk,
                "warning_count": summary.warning_count,
                "margin_utilization": summary.margin_utilization,
                "account_value": summary.account_value,
                "debug": format!("{:?}", summary)
            });
            
            Ok(HttpResponse::Ok().json(response))
        },
        Err(e) => {
            error!("Failed to get debug risk summary: {}", e);
            Ok(HttpResponse::InternalServerError().json(json!({
                "error": format!("Failed to get debug risk summary: {}", e)
            })))
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Try to load variables from .env file if it exists
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
    println!("            HYPERLIQUID RISK DASHBOARD                  ");
    println!("========================================================");
    
    // Check if user_settings.json exists, if not, create it from .env values
    let settings_path = std::path::Path::new("user_settings.json");
    if !settings_path.exists() {
        // Load configuration from environment variables
        let config = match RiskConfig::from_env() {
            Ok(config) => config,
            Err(e) => {
                error!("Failed to load configuration: {}", e);
                println!("\nConfiguration Error: {}", e);
                println!("\nPlease set the required environment variables or create settings through the dashboard.");
                println!("  WALLET_ADDRESS: Your Hyperliquid wallet address (required)");
                println!("  API_URL: Hyperliquid API URL (optional, defaults to mainnet)");
                println!("  LOG_TO_CONSOLE: Whether to log to console (optional, defaults to true)");
                println!("  LOG_TO_DATABASE: Whether to log to database (optional, defaults to false)");
                println!("  SUPABASE_URL: Supabase URL (required if LOG_TO_DATABASE is true)");
                println!("  SUPABASE_KEY: Supabase API key (required if LOG_TO_DATABASE is true)");
                println!("  LOG_INTERVAL_SECONDS: How often to log data (optional, defaults to 60)");
                println!();
                return Ok(());
            }
        };
        
        // Create initial user settings file from config
        let user_settings = config.get_user_settings();
        if let Err(e) = RiskConfig::save_user_settings(&user_settings) {
            error!("Failed to create initial user settings file: {}", e);
            println!("Warning: Failed to create initial user settings file: {}", e);
        } else {
            println!("Created initial user settings file from environment variables.");
        }
    }
    
    // Load configuration from user settings file or environment variables
    let config = match RiskConfig::from_env() {
        Ok(config) => config,
        Err(e) => {
            error!("Failed to load configuration: {}", e);
            println!("\nConfiguration Error: {}", e);
            println!("\nPlease set the required environment variables or create settings through the dashboard.");
            return Ok(());
        }
    };
    
    // Create risk management system
    let risk_system = match RiskManagementSystem::new(config.clone()).await {
        Ok(system) => system,
        Err(e) => {
            error!("Failed to initialize risk management system: {}", e);
            println!("Error: Failed to initialize risk management system: {}", e);
            return Ok(());
        }
    };
    
    // Create data logger
    let data_logger = DataLogger::new(config.clone());
    
    // Create shared state
    let app_state = Arc::new(AppState {
        risk_system: Mutex::new(risk_system),
        data_logger,
    });
    
    // Start background task to update risk analysis
    let app_state_clone = app_state.clone();
    let interval_seconds = config.log_interval_seconds;
    
    // Use a separate thread for the background task
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let mut interval = time::interval(Duration::from_secs(interval_seconds));
            
            loop {
                interval.tick().await;
                
                // Get a lock on the risk system
                let mut risk_system = app_state_clone.risk_system.lock().unwrap();
                
                // Perform risk analysis
                match risk_system.analyze_risk_profile().await {
                    Ok(_) => {
                        info!("Updated risk analysis");
                    },
                    Err(e) => {
                        error!("Failed to update risk analysis: {}", e);
                    }
                }
            }
        });
    });
    
    // Start the HTTP server
    let port = env::var("DASHBOARD_PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(8080);
    
    println!("Starting dashboard server on http://localhost:{}", port);
    
    HttpServer::new(move || {
        // Configure CORS
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);
        
        App::new()
            .wrap(cors)
            .app_data(web::Data::new(app_state.clone()))
            // API routes
            .route("/api/risk_analysis", web::get().to(get_risk_analysis))
            .route("/api/risk_summary", web::get().to(get_risk_summary))
            .route("/api/positions", web::get().to(get_positions))
            .route("/api/metrics/{metric}", web::get().to(get_metric_history))
            .route("/api/positions/{coin}/{metric}", web::get().to(get_position_history))
            .route("/api/settings", web::get().to(get_settings))
            .route("/api/settings", web::post().to(update_settings))
            .route("/api/debug/risk_summary", web::get().to(debug_risk_summary))
            // Static files
            .service(fs::Files::new("/", "dashboard/static").index_file("index.html"))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
} 