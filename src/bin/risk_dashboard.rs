use std::env;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use actix_cors::Cors;
use actix_files as fs;
use actix_web::{web, App, HttpResponse, HttpServer, Responder, Result, middleware};
use log::{info, error};
use serde_json::json;
use tokio::time;
use actix_web::http;
use actix_web::http::header;
use actix_governor::{Governor, GovernorConfigBuilder};
use std::sync::RwLock;
use std::time::{Duration, Instant};
use tokio::sync::oneshot;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use parking_lot::RwLock as PLRwLock;

use hyperliquid_rust_sdk::risk_management::{
    RiskManagementSystem, RiskConfig, DataLogger
};

// Cache structure for risk data
struct RiskCache {
    last_update: Instant,
    risk_summary: Option<serde_json::Value>,
    risk_analysis: Option<serde_json::Value>,
    cache_duration: Duration,
}

impl RiskCache {
    fn new(cache_duration_secs: u64) -> Self {
        Self {
            last_update: Instant::now(),
            risk_summary: None,
            risk_analysis: None,
            cache_duration: Duration::from_secs(cache_duration_secs),
        }
    }

    fn is_fresh(&self) -> bool {
        self.last_update.elapsed() < self.cache_duration
    }
}

// Shared state between threads
struct AppState {
    risk_system: PLRwLock<RiskManagementSystem>,
    data_logger: DataLogger,
    cache: PLRwLock<RiskCache>,
    is_updating: AtomicBool,
}

// API endpoint to get the latest risk analysis with caching
async fn get_risk_analysis(data: web::Data<Arc<AppState>>) -> Result<impl Responder> {
    // Try to get cached data first
    {
        let cache = data.cache.read();
        if cache.is_fresh() {
            if let Some(cached_analysis) = &cache.risk_analysis {
                return Ok(HttpResponse::Ok().json(cached_analysis));
            }
        }
    }
    
    // If no fresh cache, get new data
    match data.risk_system.try_read_for(Duration::from_secs(5)) {
        Some(risk_system) => {
            match risk_system.analyze_risk_profile().await {
                Ok(analysis) => {
                    let response = json!({
                        "positions": analysis.positions,
                        "portfolio_metrics": analysis.portfolio_metrics,
                        "position_metrics": analysis.position_metrics,
                        "warnings": analysis.warnings,
                    });
                    
                    // Update cache
                    let mut cache = data.cache.write();
                    cache.risk_analysis = Some(response.clone());
                    cache.last_update = Instant::now();
                    
                    Ok(HttpResponse::Ok().json(response))
                },
                Err(e) => {
                    error!("Failed to get risk analysis: {}", e);
                    Ok(HttpResponse::InternalServerError().json(json!({
                        "error": format!("Failed to get risk analysis: {}", e)
                    })))
                }
            }
        },
        None => {
            Ok(HttpResponse::ServiceUnavailable().json(json!({
                "error": "Service is temporarily busy. Please try again."
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
    
    // Validate metric name - only allow specific known metrics
    let valid_metrics = [
        "portfolio_heat", "concentration_score", "risk_adjusted_return", 
        "margin_utilization", "total_unrealized_pnl", "account_value", 
        "total_position_value", "average_leverage"
    ];
    
    if !valid_metrics.contains(&metric_name.as_str()) {
        return Ok(HttpResponse::BadRequest().json(json!({
            "error": format!("Invalid metric name: {}. Valid metrics are: {}", 
                            metric_name, valid_metrics.join(", "))
        })));
    }
    
    // Validate and parse limit parameter
    let limit = match query.get("limit") {
        Some(limit_str) => {
            match limit_str.parse::<usize>() {
                Ok(limit) if limit > 0 && limit <= 1000 => limit,
                Ok(_) => {
                    return Ok(HttpResponse::BadRequest().json(json!({
                        "error": "Limit must be between 1 and 1000"
                    })));
                },
                Err(_) => {
                    return Ok(HttpResponse::BadRequest().json(json!({
                        "error": "Invalid limit parameter, must be a positive number"
                    })));
                }
            }
        },
        None => 100 // Default limit
    };
    
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
                "debug_info": format!("{:?}", summary)
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

// Background task to update risk analysis
async fn update_risk_analysis(app_state: Arc<AppState>) {
    let mut interval = time::interval(Duration::from_secs(app_state.config.log_interval_seconds));
    
    loop {
        interval.tick().await;
        
        // Check if another update is in progress
        if app_state.is_updating.compare_exchange(
            false, true, Ordering::SeqCst, Ordering::SeqCst
        ).is_err() {
            continue; // Skip this update if another one is in progress
        }
        
        // Get a write lock with timeout
        if let Some(mut risk_system) = app_state.risk_system.try_write_for(Duration::from_secs(5)) {
            match risk_system.analyze_risk_profile().await {
                Ok(analysis) => {
                    // Update cache
                    let mut cache = app_state.cache.write();
                    cache.risk_analysis = Some(json!({
                        "positions": analysis.positions,
                        "portfolio_metrics": analysis.portfolio_metrics,
                        "position_metrics": analysis.position_metrics,
                        "warnings": analysis.warnings,
                    }));
                    cache.last_update = Instant::now();
                    info!("Updated risk analysis cache");
                },
                Err(e) => {
                    error!("Failed to update risk analysis: {}", e);
                }
            }
        }
        
        // Reset the update flag
        app_state.is_updating.store(false, Ordering::SeqCst);
    }
}

// Health check endpoint with improved responsiveness
async fn health_check(data: web::Data<Arc<AppState>>) -> impl Responder {
    // Quick check if we can acquire a read lock
    if data.risk_system.try_read_for(Duration::from_millis(100)).is_some() {
        HttpResponse::Ok().json(json!({
            "status": "ok",
            "message": "Service is healthy",
            "cache_status": data.cache.read().is_fresh()
        }))
    } else {
        HttpResponse::ServiceUnavailable().json(json!({
            "status": "busy",
            "message": "Service is temporarily busy"
        }))
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
    
    // Create shared state with RwLock and cache
    let app_state = Arc::new(AppState {
        risk_system: PLRwLock::new(risk_system),
        data_logger,
        cache: PLRwLock::new(RiskCache::new(30)), // 30-second cache
        is_updating: AtomicBool::new(false),
    });
    
    // Start background task with the new update function
    let app_state_clone = app_state.clone();
    tokio::spawn(async move {
        update_risk_analysis(app_state_clone).await;
    });
    
    // Start the HTTP server
    let port = env::var("PORT")
        .or_else(|_| env::var("DASHBOARD_PORT"))
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(8080);
    
    println!("Starting dashboard server on http://0.0.0.0:{}", port);
    info!("Starting dashboard server on http://0.0.0.0:{}", port);
    
    // Log environment variables for debugging
    println!("Environment variables:");
    println!("PORT={:?}", env::var("PORT"));
    println!("DASHBOARD_PORT={:?}", env::var("DASHBOARD_PORT"));
    println!("RENDER={:?}", env::var("RENDER"));
    
    // Configure rate limiting
    // Default: 300 requests per minute per client IP for general endpoints (increased from 60)
    let general_requests_per_minute = env::var("RATE_LIMIT_REQUESTS_PER_MINUTE")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(300)
        .max(1); // Ensure at least 1 request per minute
    
    // Higher limit for static files (600 requests per minute, increased from 120)
    let static_requests_per_minute = env::var("RATE_LIMIT_STATIC_PER_MINUTE")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(600)
        .max(1); // Ensure at least 1 request per minute
    
    // Lower limit for settings endpoints (100 requests per minute, increased from 20)
    let settings_requests_per_minute = env::var("RATE_LIMIT_SETTINGS_PER_MINUTE")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(100)
        .max(1); // Ensure at least 1 request per minute
        
    // Create rate limiter configurations
    // Ensure we have at least 1 request per second and 1 burst
    let general_governor_conf = GovernorConfigBuilder::default()
        .per_second(general_requests_per_minute / 60 + 1) // Add 1 to ensure it's never zero
        .burst_size(((general_requests_per_minute / 10) as u32).max(1)) // Ensure at least 1 burst
        .finish()
        .expect("Failed to create general rate limiter configuration");
    
    let static_governor_conf = GovernorConfigBuilder::default()
        .per_second(static_requests_per_minute / 60 + 1) // Add 1 to ensure it's never zero
        .burst_size(((static_requests_per_minute / 10) as u32).max(1)) // Ensure at least 1 burst
        .finish()
        .expect("Failed to create static rate limiter configuration");
    
    let settings_governor_conf = GovernorConfigBuilder::default()
        .per_second(settings_requests_per_minute / 60 + 1) // Add 1 to ensure it's never zero
        .burst_size(((settings_requests_per_minute / 10) as u32).max(1)) // Ensure at least 1 burst
        .finish()
        .expect("Failed to create settings rate limiter configuration");
    
    HttpServer::new(move || {
        // Configure CORS to be completely permissive
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);
        
        // Base app with security headers
        let base_app = App::new()
            .wrap(cors)
            // Add security headers middleware
            .wrap(middleware::DefaultHeaders::new()
                // Prevent the browser from MIME-sniffing
                .add((header::X_CONTENT_TYPE_OPTIONS, "nosniff"))
                // Prevent clickjacking
                .add((header::X_FRAME_OPTIONS, "DENY"))
                // Updated CSP with explicit unsafe-eval in script-src
                .add((header::CONTENT_SECURITY_POLICY, "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' *; img-src 'self' * data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:;"))
                // Referrer policy
                .add((header::REFERRER_POLICY, "strict-origin-when-cross-origin"))
                // Permissions policy
                .add((header::HeaderName::from_static("permissions-policy"), "camera=(), microphone=(), geolocation=()"))
            )
            .app_data(web::Data::new(app_state.clone()));
        
        // Build the app with different rate limits for different endpoints
        let mut app = base_app
            // API routes with general rate limit
            .service(
                web::scope("/api")
                    .wrap(Governor::new(&general_governor_conf))
                    .route("/risk_analysis", web::get().to(get_risk_analysis))
                    .route("/risk_summary", web::get().to(get_risk_summary))
                    .route("/positions", web::get().to(get_positions))
                    .route("/metrics/{metric}", web::get().to(get_metric_history))
                    .route("/positions/{coin}/{metric}", web::get().to(get_position_history))
                    // Settings endpoints with stricter rate limit
                    .service(
                        web::scope("/settings")
                            .wrap(Governor::new(&settings_governor_conf))
                            .route("", web::get().to(get_settings))
                            .route("", web::post().to(update_settings))
                    )
            );
        
        // Only add debug endpoints in development mode
        // Check if we're in development mode (not on Render)
        let is_development = env::var("RENDER").is_err();
        if is_development {
            app = app.route("/api/debug/risk_summary", web::get().to(debug_risk_summary));
        }
        
        // Add health check endpoint for Render
        app = app.route("/health", web::get().to(health_check));
        
        // Static files with higher rate limit
        app.service(
            web::scope("")
                .wrap(Governor::new(&static_governor_conf))
                .service(fs::Files::new("/", "dashboard/static").index_file("index.html"))
        )
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
} 