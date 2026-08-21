# Makefile for Data Extraction Microservice

.PHONY: install start test clean status help

# Default target
.DEFAULT_GOAL := help

# Virtual environment directory
VENV_DIR = venv
PYTHON = $(VENV_DIR)/bin/python
PIP = $(VENV_DIR)/bin/pip

help: ## Show this help message
	@echo "Data Extraction Microservice - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies and setup virtual environment
	@echo "Setting up virtual environment and installing dependencies..."
	python3 -m venv $(VENV_DIR)
	$(PIP) install --upgrade pip
	$(PIP) install -r app/requirements.txt
	$(PIP) install llama-index-readers-web
	@echo "✓ Setup complete"

start: ## Start the development server
	@./run.sh

dev: ## Start development server with auto-reload
	@if [ ! -d "$(VENV_DIR)" ]; then make install; fi
	@source $(VENV_DIR)/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

test: ## Run tests and check endpoints
	@./dev.sh test

clean: ## Clean up virtual environment and cache files
	@./dev.sh clean

status: ## Check application status
	@./dev.sh status

logs: ## Show recent application logs
	@./dev.sh logs

format: ## Format code with black (if available)
	@if [ -d "$(VENV_DIR)" ]; then \
		source $(VENV_DIR)/bin/activate && \
		if command -v black >/dev/null 2>&1; then \
			black app/; \
		else \
			echo "Black not installed. Run: pip install black"; \
		fi; \
	else \
		echo "Virtual environment not found. Run 'make install' first."; \
	fi

lint: ## Run linting with flake8 (if available)
	@if [ -d "$(VENV_DIR)" ]; then \
		source $(VENV_DIR)/bin/activate && \
		if command -v flake8 >/dev/null 2>&1; then \
			flake8 app/; \
		else \
			echo "Flake8 not installed. Run: pip install flake8"; \
		fi; \
	else \
		echo "Virtual environment not found. Run 'make install' first."; \
	fi

requirements: ## Update requirements.txt with current packages
	@if [ -d "$(VENV_DIR)" ]; then \
		source $(VENV_DIR)/bin/activate && \
		pip freeze > app/requirements.txt; \
		echo "✓ Requirements updated"; \
	else \
		echo "Virtual environment not found. Run 'make install' first."; \
	fi