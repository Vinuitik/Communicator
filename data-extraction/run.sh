#!/bin/bash

# Script to run the data extraction microservice
set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "app/main.py" ]; then
    print_error "main.py not found. Please run this script from the data-extraction directory."
    exit 1
fi

print_status "Starting Data Extraction Microservice..."

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
print_info "Python version: $PYTHON_VERSION"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    print_warning "Virtual environment not found. Creating one..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        print_error "Failed to create virtual environment"
        exit 1
    fi
fi

# Activate virtual environment
print_info "Activating virtual environment..."
source venv/bin/activate

# Check if packages are installed
if ! python -c "import fastapi, uvicorn, llama_index" 2>/dev/null; then
    print_warning "Required packages not found. Installing dependencies..."
    pip install --upgrade pip
    pip install -r app/requirements.txt
    pip install llama-index-readers-web
    print_status "Dependencies installed successfully"
else
    print_info "All required packages are already installed"
fi

# Check if port 8000 is already in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "Port 8000 is already in use. Attempting to find an alternative port..."
    PORT=8001
    while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; do
        PORT=$((PORT + 1))
        if [ $PORT -gt 8010 ]; then
            print_error "Could not find an available port between 8000-8010"
            exit 1
        fi
    done
    print_info "Using port $PORT instead"
else
    PORT=8000
fi

print_status "Starting server on http://0.0.0.0:$PORT"
print_info "API Documentation: http://localhost:$PORT/docs"
print_warning "Press Ctrl+C to stop the server"

# Run the application
uvicorn app.main:app --host 0.0.0.0 --port $PORT --reload