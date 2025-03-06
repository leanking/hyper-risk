# Use a multi-stage build for smaller final image
FROM rust:1.76-slim as builder

# Create a new empty shell project
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y pkg-config libssl-dev

# Copy over your manifests
COPY Cargo.toml Cargo.lock ./

# This is a trick to pre-build dependencies
# Create a dummy main.rs that will compile successfully
RUN mkdir -p src && \
    echo "fn main() {println!(\"if you see this, the build broke\")}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Now copy your actual source code
COPY src ./src
COPY dashboard ./dashboard

# Build for release with optimized settings
RUN touch src/main.rs && \
    RUSTFLAGS="-C target-cpu=native" cargo build --release

# Final stage: create a slim image
FROM debian:bullseye-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy the build artifact from the builder stage
COPY --from=builder /usr/src/app/target/release/risk_dashboard /usr/local/bin/

# Copy static files
COPY --from=builder /usr/src/app/dashboard /usr/local/bin/dashboard

# Set the startup command
WORKDIR /usr/local/bin
ENV DASHBOARD_PORT=8080
EXPOSE 8080

# Run as non-root user for better security
RUN useradd -m appuser
USER appuser

CMD ["risk_dashboard"] 