#!/bin/sh
# Ollama Startup Script
# This script starts Ollama server and pulls the local chat model.
#
# NOT currently invoked — docker-compose.yml's ollama service runs an inline
# `command:` with the same logic instead of calling this mounted file. Kept
# in sync anyway so whichever one someone reads next isn't stale.

echo "Starting Ollama server..."
/bin/ollama serve &

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
sleep 10

# Check if model is already downloaded
if /bin/ollama list | grep -q "llama3.2:3b"; then
    echo "Model already downloaded, skipping pull..."
else
    echo "Pulling chat model llama3.2:3b..."
    /bin/ollama pull llama3.2:3b
    echo "Model pull completed!"
fi

# Keep container running
echo "Ollama is ready!"
wait
