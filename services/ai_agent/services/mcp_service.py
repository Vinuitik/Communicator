from typing import Optional, List, Any
from langchain_mcp_adapters.client import MultiServerMCPClient
from config.settings import settings
import logging
import asyncio

logger = logging.getLogger(__name__)

class MCPService:
    """Service for managing MCP client connections and tool operations"""
    
    def __init__(self):
        self.mcp_client: Optional[MultiServerMCPClient] = None
        self.tools: Optional[List[Any]] = None
        self._initialized = False
    
    async def initialize(self) -> None:
        """Initialize the MCP client and retrieve available tools"""
        if self._initialized:
            logger.info("MCP service already initialized")
            return
        
        try:
            await self._setup_mcp_client()
            self._initialized = True
            logger.info("MCP service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize MCP service: {e}")
            raise
    
    async def _setup_mcp_client(self) -> None:
        """Setup the MCP client and retrieve tools with retry logic"""
        max_retries = settings.mcp_retry_attempts
        retry_delay = getattr(settings, 'mcp_connection_retry_delay', 2)
        
        for attempt in range(max_retries + 1):
            try:
                logger.info(f"Loading in-process MCP tools via stdio (attempt {attempt + 1}/{max_retries + 1})")
                # MCP server runs in-process: the adapter spawns knowledgeMCP as a
                # stdio subprocess of ai_agent (no separate container, no HTTP, and
                # no self-connection ordering issue). cwd is /app (ai_agent WORKDIR).
                self.mcp_client = MultiServerMCPClient({
                    "my_mcp": {
                        "transport": "stdio",
                        "command": "python",
                        "args": ["knowledgeMCP/knowledgeMCP.py"],
                    }
                })

                self.tools = await self.mcp_client.get_tools()
                logger.info(f"Successfully retrieved {len(self.tools)} tools from in-process MCP")
                return

            except Exception as e:
                logger.warning(f"MCP tool-load attempt {attempt + 1} failed: {str(e)}")
                if attempt < max_retries:
                    logger.info(f"Retrying in {retry_delay} seconds...")
                    await asyncio.sleep(retry_delay)
                else:
                    logger.error(f"Failed to load in-process MCP tools after {max_retries + 1} attempts")
                    raise Exception(f"Could not load in-process MCP tools (knowledgeMCP/knowledgeMCP.py): {str(e)}")
    
    def get_tool_by_name(self, tool_name: str) -> Optional[Any]:
        """
        Get a specific tool by name
        
        Args:
            tool_name: Name of the tool to retrieve
            
        Returns:
            Tool instance if found, None otherwise
        """
        if not self.tools:
            logger.warning("No tools available. MCP service may not be initialized.")
            return None
            
        for tool in self.tools:
            if tool.name == tool_name:
                logger.debug(f"Found tool: {tool_name}")
                return tool
        
        logger.warning(f"Tool not found: {tool_name}")
        return None
    
    def list_available_tools(self) -> List[str]:
        """
        Get list of available tool names
        
        Returns:
            List of tool names
        """
        if not self.tools:
            logger.warning("No tools available")
            return []
        
        tool_names = [tool.name for tool in self.tools]
        logger.debug(f"Available tools: {tool_names}")
        return tool_names
    
    def get_tools(self) -> List[Any]:
        """
        Get all available tools
        
        Returns:
            List of all tool instances
        """
        if not self.tools:
            logger.warning("No tools available")
            return []
        return self.tools
    
    async def refresh_tools(self) -> None:
        """Refresh the tools list from the MCP server"""
        if not self.mcp_client:
            raise RuntimeError("MCP client not initialized. Call initialize() first.")
        
        logger.info("Refreshing tools from MCP server")
        self.tools = await self.mcp_client.get_tools()
        logger.info(f"Successfully refreshed {len(self.tools)} tools")
    
    @property
    def is_initialized(self) -> bool:
        """Check if the service is initialized"""
        return self._initialized
    
    async def cleanup(self) -> None:
        """Cleanup MCP client resources"""
        if self.mcp_client:
            logger.info("Cleaning up MCP client")
            # Add any cleanup logic if needed by the MCP client
            self.mcp_client = None
            self.tools = None
            self._initialized = False
