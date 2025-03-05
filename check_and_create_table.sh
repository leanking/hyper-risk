#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
    source .env
else
    echo "Error: .env file not found"
    exit 1
fi

# Check if required variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "Error: SUPABASE_URL and SUPABASE_KEY must be set in .env file"
    exit 1
fi

# Remove trailing slash from URL if present
SUPABASE_URL=${SUPABASE_URL%/}

echo "Checking if risk_logs table exists in Supabase..."

# Check if the table exists
TABLE_CHECK=$(curl -s -X GET \
    "$SUPABASE_URL/rest/v1/risk_logs?limit=1" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -w "%{http_code}" \
    -o /dev/null)

if [ "$TABLE_CHECK" -eq 404 ]; then
    echo "Table 'risk_logs' does not exist. Creating it now..."
    
    # Create the table using the SQL from supabase_setup.sql
    SQL_SCRIPT=$(cat supabase_setup.sql)
    
    # Execute the SQL script using the Supabase REST API
    CREATE_RESPONSE=$(curl -s -X POST \
        "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
        -H "apikey: $SUPABASE_KEY" \
        -H "Authorization: Bearer $SUPABASE_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"$SQL_SCRIPT\"}" \
        -w "%{http_code}" \
        -o /dev/null)
    
    if [ "$CREATE_RESPONSE" -eq 200 ] || [ "$CREATE_RESPONSE" -eq 201 ]; then
        echo "Table 'risk_logs' created successfully!"
    else
        echo "Error creating table. HTTP status: $CREATE_RESPONSE"
        echo "Please run the SQL script manually in the Supabase SQL Editor:"
        echo "1. Go to https://app.supabase.io/project/_/sql"
        echo "2. Copy and paste the contents of supabase_setup.sql"
        echo "3. Click 'Run'"
    fi
elif [ "$TABLE_CHECK" -eq 200 ]; then
    echo "Table 'risk_logs' already exists."
else
    echo "Error checking table. HTTP status: $TABLE_CHECK"
    echo "Please check your Supabase URL and API key."
fi

# Test inserting a sample record
echo "Testing database connection with a sample record..."

TIMESTAMP=$(date +%s)
SAMPLE_DATA="{\"timestamp\": $TIMESTAMP, \"positions\": [], \"portfolio_metrics\": {}, \"position_metrics\": [], \"warnings\": []}"

INSERT_RESPONSE=$(curl -s -X POST \
    "$SUPABASE_URL/rest/v1/risk_logs" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "$SAMPLE_DATA" \
    -w "%{http_code}" \
    -o /dev/null)

if [ "$INSERT_RESPONSE" -eq 201 ]; then
    echo "Successfully inserted test record! Database connection is working."
else
    echo "Error inserting test record. HTTP status: $INSERT_RESPONSE"
    echo "Please check your Supabase configuration and table permissions."
fi

echo "Done." 