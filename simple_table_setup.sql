-- Simple SQL script to set up the risk_logs table in Supabase
-- Copy and paste this entire script into the Supabase SQL Editor and click "Run"

-- Create the risk_logs table
CREATE TABLE IF NOT EXISTS risk_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    positions JSONB NOT NULL,
    portfolio_metrics JSONB NOT NULL,
    position_metrics JSONB NOT NULL,
    warnings JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index on timestamp for faster queries
CREATE INDEX IF NOT EXISTS idx_risk_logs_timestamp ON risk_logs(timestamp);

-- Add RLS policy that allows authenticated users to insert data
ALTER TABLE risk_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow inserts for authenticated users
CREATE POLICY "Allow inserts for authenticated users" ON risk_logs 
FOR INSERT WITH CHECK (true);

-- Create policy to allow reads for authenticated users
CREATE POLICY "Allow reads for authenticated users" ON risk_logs 
FOR SELECT USING (true); 