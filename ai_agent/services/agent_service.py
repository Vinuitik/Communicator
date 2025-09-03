from typing import Optional, List, Any, Dict
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent
from ..config.settings import settings

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
        """Setup the MCP client and retrieve tools"""
        self.mcp_client = MultiServerMCPClient({
            "my_mcp": {
                "transport": "streamable_http",
                "url": settings.mcp_server_url,
            }
        })
        
        self.tools = await self.mcp_client.get_tools()
        print(f"Retrieved {len(self.tools)} tools from MCP server")
    
    def _setup_llm(self) -> None:
        """Setup the Google Gemini LLM"""
        self.llm = ChatGoogleGenerativeAI(
            model=settings.llm_model,
            google_api_key=settings.gemini_api_key,
            temperature=settings.llm_temperature,
            transport="rest"
        )
        print(f"LLM initialized with model: {settings.llm_model}")
    
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
