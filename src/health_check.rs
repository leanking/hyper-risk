use warp::Filter;

/// Creates a health check route that responds with 200 OK
/// This is used by Render to determine if the application is healthy
pub fn health_check_route() -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
    warp::path("health")
        .and(warp::get())
        .map(|| {
            // Log that a health check was received
            println!("Health check request received");
            
            // Return a simple 200 OK response
            warp::reply::with_status(
                "OK",
                warp::http::StatusCode::OK,
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use warp::http::StatusCode;
    use warp::test::request;

    #[tokio::test]
    async fn test_health_check() {
        let health_route = health_check_route();

        let response = request()
            .method("GET")
            .path("/health")
            .reply(&health_route)
            .await;

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.body(), "OK");
    }
} 