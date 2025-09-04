import os
import yaml
from pathlib import Path
from typing import Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings:
    """Application configuration settings loaded from YAML config and environment variables"""
    
    def __init__(self, config_file: str = "config.yaml"):
        # Load YAML configuration
        self.config = self._load_config(config_file)
        
        # Apply environment-specific overrides
        self._apply_environment_overrides()
        
        # Application settings
        self.app_name = self.config["app"]["name"]
        self.app_version = self.config["app"]["version"]
        self.host = self.config["app"]["host"]
        self.port = self.config["app"]["port"]
        self.debug = self.config["app"]["debug"]
        self.log_level = self.config["app"]["log_level"]
        
        # LLM settings
        self.llm_model = self.config["llm"]["model"]
        self.llm_temperature = self.config["llm"]["temperature"]
        self.llm_max_tokens = self.config["llm"]["max_tokens"]
        self.llm_timeout = self.config["llm"]["timeout"]
        
        # MCP settings
        self.mcp_server_url = self.config["mcp"]["server_url"]
        self.mcp_timeout = self.config["mcp"]["timeout"]
        self.mcp_retry_attempts = self.config["mcp"]["retry_attempts"]
        self.mcp_connection_retry_delay = self.config["mcp"].get("connection_retry_delay", 2)
        
        # Database settings
        self.mongodb_url = self.config["databases"]["mongodb"]["url"]
        self.mongodb_database = self.config["databases"]["mongodb"]["database"]
        self.mongodb_connection_timeout = self.config["databases"]["mongodb"]["connection_timeout"]
        self.mongodb_server_selection_timeout = self.config["databases"]["mongodb"]["server_selection_timeout"]
        self.mongodb_max_pool_size = self.config["databases"]["mongodb"]["max_pool_size"]
        self.mongodb_min_pool_size = self.config["databases"]["mongodb"]["min_pool_size"]
        
        self.redis_url = self.config["databases"]["redis"]["url"]
        self.redis_database = self.config["databases"]["redis"]["database"]
        self.redis_connection_timeout = self.config["databases"]["redis"]["connection_timeout"]
        self.redis_retry_on_timeout = self.config["databases"]["redis"]["retry_on_timeout"]
        self.redis_max_connections = self.config["databases"]["redis"]["max_connections"]
        
        # Cache settings
        self.cache_default_ttl = self.config["cache"]["default_ttl"]
        self.cache_friend_summary_ttl = self.config["cache"]["friend_summary_ttl"]
        self.cache_tool_cache_ttl = self.config["cache"]["tool_cache_ttl"]
        
        # Knowledge service settings
        self.knowledge_max_items_per_request = self.config["knowledge"]["max_knowledge_items_per_request"]
        self.knowledge_summarization_batch_size = self.config["knowledge"]["summarization_batch_size"]
        self.knowledge_enable_caching = self.config["knowledge"]["enable_caching"]
        
        # Environment variables (still support for sensitive data)
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        
        # Validate required settings
        if not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
    
    def _load_config(self, config_file: str) -> Dict[str, Any]:
        """Load configuration from YAML file"""
        config_path = Path(__file__).parent / config_file
        
        if not config_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
        
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def _apply_environment_overrides(self):
        """Apply environment-specific configuration overrides"""
        environment = os.getenv("ENVIRONMENT", "development").lower()
        
        if environment in self.config:
            env_config = self.config[environment]
            self._deep_update(self.config, env_config)
    
    def _deep_update(self, base_dict: Dict[str, Any], update_dict: Dict[str, Any]):
        """Recursively update nested dictionary"""
        for key, value in update_dict.items():
            if key in base_dict and isinstance(base_dict[key], dict) and isinstance(value, dict):
                self._deep_update(base_dict[key], value)
            else:
                base_dict[key] = value
    
    def get_mongodb_connection_params(self) -> Dict[str, Any]:
        """Get MongoDB connection parameters"""
        return {
            "url": self.mongodb_url,
            "db_name": self.mongodb_database,
            "connection_timeout": self.mongodb_connection_timeout,
            "server_selection_timeout": self.mongodb_server_selection_timeout,
            "max_pool_size": self.mongodb_max_pool_size,
            "min_pool_size": self.mongodb_min_pool_size
        }
    
    def get_redis_connection_params(self) -> Dict[str, Any]:
        """Get Redis connection parameters"""
        return {
            "url": self.redis_url,
            "db": self.redis_database,
            "socket_timeout": self.redis_connection_timeout,
            "retry_on_timeout": self.redis_retry_on_timeout,
            "max_connections": self.redis_max_connections
        }

# Create global settings instance
settings = Settings()
