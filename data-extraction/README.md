# Development Guide

## Running the Application Consistently

This project provides multiple ways to run the application consistently across different environments:

### Quick Start Options

1. **Using the run script (Recommended)**:
   ```bash
   ./run.sh
   ```

2. **Using the development helper**:
   ```bash
   ./dev.sh start
   ```

3. **Using Make**:
   ```bash
   make start
   ```

### Available Commands

#### Development Helper (`./dev.sh`)
- `./dev.sh start` - Start the development server
- `./dev.sh test` - Test all endpoints
- `./dev.sh install` - Install/update dependencies
- `./dev.sh clean` - Clean up virtual environment and caches
- `./dev.sh status` - Check application status
- `./dev.sh logs` - Show recent logs

#### Make Commands
- `make install` - Setup virtual environment and install dependencies
- `make start` - Start the server
- `make dev` - Start with auto-reload
- `make test` - Run tests
- `make status` - Check status
- `make clean` - Clean up
- `make help` - Show all available commands

### Project Structure
```
data-extraction/
├── app/
│   ├── main.py          # Main FastAPI application
│   ├── requirements.txt # Python dependencies
│   ├── config/         # Configuration files
│   ├── models/         # Data models
│   ├── prompts/        # AI prompts
│   ├── repositories/   # Data access layer
│   ├── routers/        # API routes
│   ├── services/       # Business logic
│   └── utils/          # Utility functions
├── venv/               # Virtual environment (auto-created)
├── run.sh              # Main run script
├── dev.sh              # Development helper
├── Makefile            # Make commands
└── .gitignore          # Local ignore rules
```

## Multi-Level GitIgnore Setup

This project uses a hierarchical `.gitignore` structure that allows for organized ignore rules across different parts of the project:

### How It Works

Git processes `.gitignore` files in the following order:
1. **Root level** (`/Communicator/.gitignore`) - Global patterns for the entire project
2. **Subdirectory level** (`/Communicator/data-extraction/.gitignore`) - Specific to this microservice
3. **Nested subdirectories** - Each can have their own `.gitignore`

### Ignore File Hierarchy

```
Communicator/
├── .gitignore                    # Global rules (IDE files, secrets, resources)
├── data-extraction/
│   └── .gitignore               # Python/FastAPI specific rules
├── connections/
│   └── .gitignore               # Connection service specific rules
├── group/
│   └── .gitignore               # Group service specific rules
└── ai_agent/
    └── .gitignore               # AI agent specific rules
```

### Root Level Rules (`/Communicator/.gitignore`)
- IDE and editor files (.vscode/, .idea/, etc.)
- OS generated files (.DS_Store, Thumbs.db)
- Global secrets and keys
- Shared resource directories
- Common cache and log files

### Service Level Rules (`/Communicator/data-extraction/.gitignore`)
- Virtual environments (venv/, env/)
- Python bytecode (__pycache__/, *.pyc)
- Service-specific logs and temporary files
- Local development databases
- Service-specific environment files

### Benefits of This Approach

1. **Separation of Concerns**: Each service manages its own ignore patterns
2. **Reusability**: Common patterns are defined once at the root
3. **Flexibility**: Teams can work on different services without conflicts
4. **Maintainability**: Easy to update service-specific rules without affecting others

### Best Practices

1. **Root `.gitignore`**: Keep it focused on truly global patterns
2. **Service `.gitignore`**: Include patterns specific to that technology stack
3. **Avoid Duplication**: Don't repeat root-level patterns in service-level files
4. **Use Wildcards Wisely**: Use `**/pattern` for recursive matching when needed

### Managing Changes

When working on different services:
```bash
# Check what's being ignored
git status --ignored

# Check ignore rules for a specific file
git check-ignore -v path/to/file

# Test ignore patterns
git ls-files --ignored --exclude-standard
```

### Adding New Services

When creating a new service:
1. Create the service directory
2. Add a service-specific `.gitignore`
3. Update root `.gitignore` only if needed for global patterns
4. Test with `git status` to ensure proper ignore behavior

This setup allows each developer to work locally within their service directory while maintaining proper version control hygiene across the entire project.