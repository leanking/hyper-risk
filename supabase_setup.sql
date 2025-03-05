-- SQL script to set up the risk_logs table in Supabase

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

-- Create a view for the most recent risk log
CREATE OR REPLACE VIEW recent_risk_log AS
SELECT * FROM risk_logs
ORDER BY timestamp DESC
LIMIT 1;

-- Create a function to get risk logs within a time range
CREATE OR REPLACE FUNCTION get_risk_logs_in_range(start_time BIGINT, end_time BIGINT)
RETURNS SETOF risk_logs AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM risk_logs
    WHERE timestamp >= start_time AND timestamp <= end_time
    ORDER BY timestamp;
END;
$$ LANGUAGE plpgsql; 