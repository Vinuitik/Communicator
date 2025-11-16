# Ollama Service

This directory contains the Ollama embedding service configuration.

## Model Information

- **Model**: koill/sentence-transformers:all-minilm-l6-v2
- **Size**: ~91 MB
- **Dimensions**: 384
- **Purpose**: Local self-hosted text embeddings

## Files

- `startup.sh`: Automatic model pull script on container start

## Usage

The Ollama service is automatically started with docker-compose and will:
1. Start the Ollama server
2. Pull the embedding model if not already present
3. Expose the API on port 11434

## API Endpoint

- **Base URL**: http://ollama:11434 (internal)
- **Embedding Endpoint**: POST /api/embeddings
- **Health Check**: GET /api/tags
