/// Utility functions to ensure proper port configuration for Render deployment

/// Gets the port from the environment or uses a default
/// This is critical for Render deployment as Render sets the PORT environment variable
pub fn get_port() -> u16 {
    std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(8080)
}

/// Logs the port configuration for debugging
pub fn log_port_config() {
    let port = get_port();
    let port_source = if std::env::var("PORT").is_ok() {
        "environment variable"
    } else {
        "default value"
    };
    
    println!("Server starting on port {} (from {})", port, port_source);
    
    // Additional environment checks
    if let Ok(dashboard_port) = std::env::var("DASHBOARD_PORT") {
        println!("Warning: DASHBOARD_PORT is set to {}, but Render will use PORT={}", dashboard_port, port);
        println!("Make sure your application uses the PORT environment variable, not DASHBOARD_PORT");
    }
}

/// Checks if the application is properly configured for Render
/// Returns a list of warnings or issues
pub fn check_render_configuration() -> Vec<String> {
    let mut warnings = Vec::new();
    
    // Check PORT environment variable
    if std::env::var("PORT").is_err() {
        warnings.push("PORT environment variable is not set. Render sets this automatically, but it's missing in your current environment.".to_string());
    }
    
    // Check for conflicting port configurations
    if let Ok(dashboard_port) = std::env::var("DASHBOARD_PORT") {
        if let Ok(port) = std::env::var("PORT") {
            if dashboard_port != port {
                warnings.push(format!(
                    "DASHBOARD_PORT ({}) differs from PORT ({}). This may cause issues on Render.",
                    dashboard_port, port
                ));
            }
        }
    }
    
    // Check for common issues
    if std::env::var("HOST").is_ok() {
        warnings.push("HOST environment variable is set. Make sure your application binds to 0.0.0.0, not localhost or 127.0.0.1.".to_string());
    }
    
    warnings
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_get_port_default() {
        std::env::remove_var("PORT");
        assert_eq!(get_port(), 8080);
    }
    
    #[test]
    fn test_get_port_from_env() {
        std::env::set_var("PORT", "9000");
        assert_eq!(get_port(), 9000);
        std::env::remove_var("PORT");
    }
} 