import aiohttp
import asyncio
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class APIHandler:
    def __init__(self):
        self.base_url = ""  # Keep blank for now as requested
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def make_request(
        self, 
        method: str, 
        endpoint: str, 
        headers: Dict[str, str] = None,
        data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Make an API request"""
        
        # For now, return a mock response since URL is blank
        if not self.base_url:
            return {
                "status": "mock_response",
                "message": f"Would make {method} request to {endpoint}",
                "headers": headers or {},
                "data": data or {},
                "note": "Base URL not configured - this is a mock response"
            }
        
        session = await self._get_session()
        url = f"{self.base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        
        try:
            async with session.request(
                method=method.upper(),
                url=url,
                headers=headers,
                json=data if method.upper() in ['POST', 'PUT'] else None
            ) as response:
                response_data = await response.json()
                
                return {
                    "status_code": response.status,
                    "data": response_data,
                    "headers": dict(response.headers)
                }
                
        except Exception as e:
            logger.error(f"Request failed: {e}")
            raise
    
    async def get_status(self) -> Dict[str, Any]:
        """Get API wrapper status"""
        return {
            "service": "MCP API Wrapper",
            "status": "running",
            "base_url": self.base_url or "not_configured",
            "session_active": self.session is not None and not self.session.closed
        }
    
    async def close(self):
        """Close the session"""
        if self.session and not self.session.closed:
            await self.session.close()