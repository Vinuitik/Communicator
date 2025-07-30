#!/bin/bash

# Start both backup services in parallel
echo "Starting backup services..."

# Start PostgreSQL backup service in background
echo "Starting PostgreSQL backup service..."
java PostgresBackupService &
POSTGRES_PID=$!

# Start file backup service in background  
echo "Starting file backup service..."
java FileBackupService &
FILES_PID=$!

echo "Both backup services started:"
echo "  PostgreSQL backup service PID: $POSTGRES_PID"
echo "  File backup service PID: $FILES_PID"

# Function to handle shutdown
shutdown() {
    echo "Shutting down backup services..."
    kill $POSTGRES_PID 2>/dev/null
    kill $FILES_PID 2>/dev/null
    wait
    echo "Backup services stopped."
    exit 0
}

# Trap SIGTERM and SIGINT
trap shutdown SIGTERM SIGINT

# Wait for any process to exit
wait -n

# If any process exits, shutdown both
shutdown
