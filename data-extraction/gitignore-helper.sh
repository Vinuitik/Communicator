#!/bin/bash

# GitIgnore management helper script for Communicator project

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

show_help() {
    echo "GitIgnore Management Helper"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  list         List all .gitignore files in the project"
    echo "  check [file] Check if a file/pattern is ignored"
    echo "  status       Show git status including ignored files"
    echo "  test         Test current ignore patterns"
    echo "  template     Create a .gitignore template for a new service"
    echo "  help         Show this help message"
}

list_gitignores() {
    print_status "Finding all .gitignore files in the project..."
    
    # Go to project root
    cd "$(dirname "$0")/../.." 2>/dev/null || cd ..
    
    find . -name ".gitignore" -not -path "./*/venv/*" -not -path "./.git/*" | while read file; do
        echo ""
        print_info "Found: $file"
        echo "  Lines: $(wc -l < "$file")"
        echo "  Size: $(du -h "$file" | cut -f1)"
        echo "  Sample patterns:"
        head -5 "$file" | sed 's/^/    /'
        if [ $(wc -l < "$file") -gt 5 ]; then
            echo "    ..."
        fi
    done
}

check_ignore() {
    if [ -z "$1" ]; then
        print_error "Please provide a file path to check"
        echo "Usage: $0 check <file_path>"
        return 1
    fi
    
    cd "$(dirname "$0")/../.." 2>/dev/null || cd ..
    
    print_info "Checking ignore status for: $1"
    
    if git check-ignore -v "$1" 2>/dev/null; then
        print_warning "File is IGNORED"
    else
        if [ -e "$1" ]; then
            print_status "File is NOT ignored (will be tracked)"
        else
            print_info "File does not exist, but would NOT be ignored"
        fi
    fi
}

show_status() {
    cd "$(dirname "$0")/../.." 2>/dev/null || cd ..
    
    print_info "Git status (including ignored files):"
    echo ""
    git status --ignored
}

test_patterns() {
    cd "$(dirname "$0")/../.." 2>/dev/null || cd ..
    
    print_info "Testing common file patterns..."
    
    # Test patterns
    patterns=(
        "venv/bin/python"
        "__pycache__/test.pyc"
        ".env"
        "service-account-key.json"
        "data-extraction/server.log"
        ".vscode/settings.json"
        "node_modules/package/index.js"
    )
    
    for pattern in "${patterns[@]}"; do
        if git check-ignore "$pattern" >/dev/null 2>&1; then
            echo -e "  ✓ ${GREEN}$pattern${NC} - ignored"
        else
            echo -e "  ✗ ${RED}$pattern${NC} - NOT ignored"
        fi
    done
}

create_template() {
    if [ -z "$1" ]; then
        print_error "Please provide a service name"
        echo "Usage: $0 template <service_name>"
        return 1
    fi
    
    service_name="$1"
    template_file="${service_name}/.gitignore"
    
    print_status "Creating .gitignore template for service: $service_name"
    
    if [ ! -d "$service_name" ]; then
        print_warning "Directory $service_name does not exist. Creating it..."
        mkdir -p "$service_name"
    fi
    
    cat > "$template_file" << EOF
# $service_name service specific ignores

# Environment variables
.env
.env.local
.env.development
.env.test
.env.production

# Logs
*.log
logs/

# Temporary files
*.tmp
*.temp
temp/

# Service specific cache
cache/
.cache/

# Database files (if applicable)
*.db
*.sqlite
*.sqlite3

# Add your service-specific patterns below:
# Example:
# dist/
# build/
# node_modules/ (for Node.js)
# venv/ (for Python)
# target/ (for Java/Rust)
EOF

    print_status "Created template: $template_file"
    print_info "Please edit it to add service-specific patterns"
}

# Main script logic
case "${1:-help}" in
    "list")
        list_gitignores
        ;;
    "check")
        check_ignore "$2"
        ;;
    "status")
        show_status
        ;;
    "test")
        test_patterns
        ;;
    "template")
        create_template "$2"
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