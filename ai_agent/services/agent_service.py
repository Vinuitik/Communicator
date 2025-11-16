from typing import Optional, List, Any, Dict
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent
from config.settings import settings
import logging
import asyncio
import os

# Set up logger
logger = logging.getLogger(__name__)

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "/app/service-account-key.json"

class AgentService:
    """Service for managing the LangChain agent and its dependencies"""
    
    def __init__(self):
        self.agent = None
        self.mcp_client = None
        self.llm = None
        self.tools = None
        self._initialized = False
    
    async def initialize(self) -> None:
        """Initialize the agent and all its dependencies"""
        if self._initialized:
            return
            
        print(f"Initializing AI Agent with API key: {settings.gemini_api_key}")
        
        try:
            # Setup MCP client
            await self._setup_mcp_client()
            
            # Setup LLM
            self._setup_llm()
            
            # Create agent
            self._create_agent()
            
            self._initialized = True
            print("AI Agent initialized successfully")
            
        except Exception as e:
            print(f"Failed to initialize AI Agent: {e}")
            raise
    
    async def _setup_mcp_client(self) -> None:
        """Setup the MCP client and retrieve tools with retry logic"""
        max_retries = settings.mcp_retry_attempts
        retry_delay = getattr(settings, 'mcp_connection_retry_delay', 2)
        
        for attempt in range(max_retries + 1):
            try:
                logger.info(f"Attempting to connect to MCP server (attempt {attempt + 1}/{max_retries + 1})")
                self.mcp_client = MultiServerMCPClient({
                    "my_mcp": {
                        "transport": "streamable_http",
                        "url": settings.mcp_server_url,
                    }
                })
                
                self.tools = await self.mcp_client.get_tools()
                logger.info(f"Successfully retrieved {len(self.tools)} tools from MCP server")
                return
                
            except Exception as e:
                logger.warning(f"MCP connection attempt {attempt + 1} failed: {str(e)}")
                if attempt < max_retries:
                    logger.info(f"Retrying in {retry_delay} seconds...")
                    await asyncio.sleep(retry_delay)
                else:
                    logger.error(f"Failed to connect to MCP server after {max_retries + 1} attempts")
                    raise Exception(f"Could not connect to MCP server at {settings.mcp_server_url}: {str(e)}")
    
    def _setup_llm(self) -> None:
        """Setup the Google Gemini LLM"""
        # Use service account credentials instead of API key
        self.llm = ChatGoogleGenerativeAI(
            model=settings.llm_model,
            temperature=settings.llm_temperature,
            google_api_key=None,  # Explicitly set to None to use service account
            transport="rest"
        )
        print(f"LLM initialized with model: {settings.llm_model} using service account credentials")
    
    def _create_agent(self) -> None:
        """Create the ReAct agent with LLM and tools"""
        self.agent = create_react_agent(self.llm, self.tools)
        print("ReAct agent created successfully")
    
    async def process_message(self, message: str) -> Dict[str, Any]:
        """
        Process a user message through the agent
        
        Args:
            message: User's input message
            
        Returns:
            Agent's response
        """
        if not self._initialized:
            raise RuntimeError("Agent service not initialized. Call initialize() first.")
        
        print(f"Processing message: {message}")
        
        result = await self.agent.ainvoke({
            "messages": [{"role": "user", "content": message}]
        })
        
        print(f"Agent response: {result}")
        return result
    
    async def generate_response(
        self, 
        system_message: str, 
        user_message: str
    ) -> str:
        """
        Generate a direct LLM response without using the agent/tools.
        
        This is useful for simple text generation tasks like validation,
        summarization, etc. where we don't need tool access.
        
        Args:
            system_message: System prompt/instructions
            user_message: User's input message
            
        Returns:
            LLM's text response
        """
        if not self._initialized:
            raise RuntimeError("Agent service not initialized. Call initialize() first.")
        
        logger.debug(f"Generating LLM response with system: {system_message[:100]}...")
        
        # Create messages in LangChain format
        from langchain_core.messages import SystemMessage, HumanMessage
        
        messages = [
            SystemMessage(content=system_message),
            HumanMessage(content=user_message)
        ]
        
        # Get LLM response
        result = await self.llm.ainvoke(messages)
        
        # Extract text content from the response
        response_text = result.content
        
        logger.debug(f"LLM response: {response_text[:200]}...")
        
        return response_text
    
    def get_tool_by_name(self, tool_name: str) -> Optional[Any]:
        """
        Get a specific tool by name
        
        Args:
            tool_name: Name of the tool to retrieve
            
        Returns:
            Tool instance if found, None otherwise
        """
        if not self.tools:
            return None
            
        for tool in self.tools:
            if tool.name == tool_name:
                return tool
        return None
    
    def list_available_tools(self) -> List[str]:
        """
        Get list of available tool names
        
        Returns:
            List of tool names
        """
        if not self.tools:
            return []
        return [tool.name for tool in self.tools]
    
    @property
    def is_initialized(self) -> bool:
        """Check if the service is initialized"""
        return self._initialized
