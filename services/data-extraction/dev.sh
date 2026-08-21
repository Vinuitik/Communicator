#!/bin/bash

# Development helper script for the data extraction microservice

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to show usage
show_help() {
    echo "Data Extraction Microservice Development Helper"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start the development server (default)"
    echo "  test      Run tests and check endpoints"
    echo "  install   Install/update dependencies"
    echo "  clean     Clean up virtual environment and caches"
    echo "  status    Check application status"
    echo "  logs      Show recent logs"
    echo "  help      Show this help message"
}

# Function to install dependencies
install_deps() {
    print_status "Installing/updating dependencies..."
    
    if [ ! -d "venv" ]; then
        print_info "Creating virtual environment..."
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r app/requirements.txt
    pip install llama-index-readers-web
    print_status "Dependencies installed successfully"
}

# Function to test the application
test_app() {
    print_status "Testing application endpoints..."
    
    # Check if server is running
    if ! curl -s http://localhost:8000/health >/dev/null; then
        print_error "Server is not running. Please start it first with: $0 start"
        return 1
    fi
    
    print_info "Testing root endpoint..."
    curl -s http://localhost:8000/ | jq '.' || echo "Response received"
    
    print_info "Testing health endpoint..."
    curl -s http://localhost:8000/health | jq '.' || echo "Response received"
    
    print_info "Testing web extraction endpoint..."
    curl -s "http://localhost:8000/extract/web?url=https://example.com" | jq '.status' || echo "Response received"
    
    print_status "All tests completed"
}

# Function to clean up
clean_up() {
    print_warning "Cleaning up virtual environment and caches..."
    rm -rf venv/
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find . -name "*.pyc" -delete 2>/dev/null || true
    print_status "Cleanup completed"
}

# Function to check status
check_status() {
    print_info "Checking application status..."
    
    if [ -d "venv" ]; then
        print_status "Virtual environment: ✓ Found"
    else
        print_error "Virtual environment: ✗ Not found"
    fi
    
    if curl -s http://localhost:8000/health >/dev/null; then
        print_status "Server: ✓ Running on http://localhost:8000"
    else
        print_warning "Server: ✗ Not running"
    fi
    
    if [ -f "server.log" ]; then
        print_info "Log file: ✓ Found ($(wc -l < server.log) lines)"
    else
        print_info "Log file: - Not found"
    fi
}

# Function to show logs
show_logs() {
    if [ -f "server.log" ]; then
        print_info "Showing last 20 lines of server.log:"
        tail -20 server.log
    else
        print_warning "No log file found"
    fi
}

# Main script logic
case "${1:-start}" in
    "start")
        ./run.sh
        ;;
    "test")
        test_app
        ;;
    "install")
        install_deps
        ;;
    "clean")
        clean_up
        ;;
    "status")
        check_status
        ;;
    "logs")
        show_logs
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac