"""
System test conftest: patches service URLs from environment variables.

When running in GitHub Actions the service containers are exposed on localhost,
so the env vars below redirect ai_agent settings away from the docker-compose
hostnames (generatedData, redisCache, ollama, ...) to localhost equivalents.

  MONGODB_URL     e.g. mongodb://mongo_user:example@localhost:27017
  REDIS_URL       e.g. redis://localhost:6379
  OLLAMA_URL      e.g. http://localhost:11434
  MCP_SERVER_URL  e.g. http://localhost:8002/knowledgeMCP/
  FRIEND_URL      e.g. http://localhost:8085   (usually mocked by aioresponses)
"""
import os
import pytest


@pytest.fixture(autouse=True)
def patch_settings_for_ci():
    """Override service URLs when environment-variable overrides are present."""
    from config.settings import settings

    overrides = {
        "mongodb_url":             os.getenv("MONGODB_URL"),
        "redis_url":               os.getenv("REDIS_URL"),
        "embedding_ollama_url":    os.getenv("OLLAMA_URL"),
        "mcp_server_url":          os.getenv("MCP_SERVER_URL"),
        "friend_service_url":      os.getenv("FRIEND_URL"),
    }

    saved = {}
    for attr, val in overrides.items():
        if val:
            saved[attr] = getattr(settings, attr)
            setattr(settings, attr, val)

    yield

    for attr, val in saved.items():
        setattr(settings, attr, val)
