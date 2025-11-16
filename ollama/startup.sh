#!/bin/sh
# Ollama Startup Script
# This script starts Ollama server and pulls the embedding model

echo "Starting Ollama server..."
/bin/ollama serve &

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
sleep 10

# Check if model is already downloaded
if /bin/ollama list | grep -q "koill/sentence-transformers:all-minilm-l6-v2"; then
    echo "Model already downloaded, skipping pull..."
else
    echo "Pulling embedding model koill/sentence-transformers:all-minilm-l6-v2..."
    /bin/ollama pull koill/sentence-transformers:all-minilm-l6-v2
    echo "Model pull completed!"
fi

# Keep container running
echo "Ollama is ready!"
wait
