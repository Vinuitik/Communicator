import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings:
    """Application configuration settings"""
    
    def __init__(self):
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.mcp_server_url = "http://nginx/api/mcp/knowledge/knowledgeMCP/"
        self.llm_model = "gemini-2.5-flash"
        self.llm_temperature = 0.7
        self.host = "0.0.0.0"
        self.port = 8001
        
        # Validate required settings
        if not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")

# Create global settings instance
settings = Settings()
