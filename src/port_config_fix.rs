/// Port configuration fix for Render deployment
/// 
/// This code shows how to properly configure your server to listen on all interfaces (0.0.0.0)
/// instead of just localhost, which is required for Render to route traffic to your application.

/// Example of correct server binding for a warp server
pub fn configure_warp_server() -> impl std::future::Future<Output = ()> {
    use warp::Filter;
    
    // Create your routes
    let routes = warp::any().map(|| "Hello, World!");
    
    // Get the port from environment or use default
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(8080);
    
    // IMPORTANT: Bind to 0.0.0.0 (all interfaces), not localhost
    println!("Starting server on http://0.0.0.0:{}", port);
    warp::serve(routes).run(([0, 0, 0, 0], port))
}

/// Example of correct server binding for a hyper server
pub fn configure_hyper_server() -> Result<(), Box<dyn std::error::Error>> {
    use hyper::service::{make_service_fn, service_fn};
    use hyper::{Body, Request, Response, Server};
    use std::convert::Infallible;
    
    // Simple handler function
    async fn handle(_req: Request<Body>) -> Result<Response<Body>, Infallible> {
        Ok(Response::new(Body::from("Hello, World!")))
    }
    
    // Get the port from environment or use default
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(8080);
    
    // Create the service
    let make_svc = make_service_fn(|_conn| {
        async { Ok::<_, Infallible>(service_fn(handle)) }
    });
    
    // IMPORTANT: Bind to 0.0.0.0 (all interfaces), not localhost
    let addr = ([0, 0, 0, 0], port).into();
    println!("Starting server on http://0.0.0.0:{}", port);
    
    let server = Server::bind(&addr).serve(make_svc);
    
    // Run the server
    tokio::runtime::Runtime::new()?.block_on(server)?;
    
    Ok(())
}

/// Example of correct server binding for a rocket server
pub fn configure_rocket_server() -> Result<(), rocket::Error> {
    use rocket::{routes, get, launch};
    
    #[get("/")]
    fn index() -> &'static str {
        "Hello, world!"
    }
    
    // Get the port from environment or use default
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(8080);
    
    // Configure Rocket to listen on 0.0.0.0 with the specified port
    let figment = rocket::Config::figment()
        .merge(("port", port))
        .merge(("address", "0.0.0.0"));
    
    rocket::custom(figment)
        .mount("/", routes![index])
        .launch()
}

/// Example of correct server binding for an actix-web server
pub fn configure_actix_server() -> std::io::Result<()> {
    use actix_web::{web, App, HttpServer, Responder};
    
    async fn index() -> impl Responder {
        "Hello, world!"
    }
    
    // Get the port from environment or use default
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(8080);
    
    println!("Starting server on http://0.0.0.0:{}", port);
    
    // IMPORTANT: Bind to 0.0.0.0 (all interfaces), not localhost
    HttpServer::new(|| {
        App::new().route("/", web::get().to(index))
    })
    .bind(("0.0.0.0", port))?
    .run()?;
    
    Ok(())
}

/// Generic advice for any web framework
pub fn port_binding_advice() -> String {
    r#"
IMPORTANT: For Render deployment, always bind your web server to 0.0.0.0 (all interfaces), not localhost or 127.0.0.1.

Examples for different frameworks:

1. Raw std::net::TcpListener:
   let listener = TcpListener::bind(format!("0.0.0.0:{}", port))?;

2. Warp:
   warp::serve(routes).run(([0, 0, 0, 0], port)).await;

3. Hyper:
   let addr = ([0, 0, 0, 0], port).into();
   Server::bind(&addr).serve(make_svc).await?;

4. Rocket:
   let figment = rocket::Config::figment()
       .merge(("port", port))
       .merge(("address", "0.0.0.0"));
   rocket::custom(figment).mount("/", routes![index]).launch().await?;

5. Actix-web:
   HttpServer::new(|| App::new().route("/", web::get().to(index)))
       .bind(("0.0.0.0", port))?
       .run()
       .await?;

6. Axum:
   let addr = SocketAddr::from(([0, 0, 0, 0], port));
   axum::Server::bind(&addr).serve(app.into_make_service()).await?;
"#.to_string()
} 