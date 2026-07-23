from typing import Optional, List, Any, Dict, AsyncIterator
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent
from config.settings import settings
from services.mcp_service import MCPService
import logging
import asyncio
import os

# Set up logger
logger = logging.getLogger(__name__)

class AgentService:
    """Service for managing the LangChain agent and its dependencies"""
    
    def __init__(self):
        self.agent = None
        self.mcp_service = MCPService()
        self.llm = None
        self._initialized = False
    
    async def initialize(self) -> None:
        """Initialize the agent and all its dependencies"""
        if self._initialized:
            return
            
        print(f"Initializing AI Agent (GEMINI_API_KEY {'set' if settings.gemini_api_key else 'MISSING'})")
        
        try:
            # Initialize MCP service
            await self.mcp_service.initialize()
            
            # Setup LLM
            self._setup_llm()
            
            # Create agent
            self._create_agent()
            
            self._initialized = True
            print("AI Agent initialized successfully")
            
        except Exception as e:
            print(f"Failed to initialize AI Agent: {e}")
            raise
    
    def _setup_llm(self) -> None:
        """Setup the Google Gemini LLM"""
        self.llm = ChatGoogleGenerativeAI(
            model=settings.llm_model,
            temperature=settings.llm_temperature,
            google_api_key=settings.gemini_api_key,
            transport="rest"
        )
        print(f"LLM initialized with model: {settings.llm_model} using GEMINI_API_KEY")
    
    def _create_agent(self) -> None:
        """Create the ReAct agent with LLM and tools"""
        tools = self.mcp_service.get_tools()
        self.agent = create_react_agent(self.llm, tools)
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

    @staticmethod
    def _extract_text(content: Any) -> str:
        """Normalize Gemini's list-or-string message content to plain text.

        Gemini can return `content` as a str, or a list of parts like
        `[{'type':'text','text':'...'}]`. Both must collapse to a string.
        """
        if content is None:
            return ""
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: List[str] = []
            for item in content:
                if isinstance(item, dict):
                    parts.append(str(item.get("text", "")))
                else:
                    parts.append(str(item))
            return "".join(parts)
        return str(content)

    async def stream_message(
        self, messages: List[Dict[str, Any]]
    ) -> AsyncIterator[Dict[str, Any]]:
        """Stream the agent's lifecycle for one turn of a conversation.

        `messages` is the FULL conversation so far (role/content dicts), ending
        with the new user turn. Passing the whole history each call is what gives
        the agent memory — the graph is otherwise stateless and would start from
        scratch every message. Fine for chit-chat volumes; the caller caps length.

        Yields dicts shaped for `WebSocketMessage` so the UI can render finer
        states (thinking / tool_call / tool_result / token / ai_response / error)
        instead of one opaque blob. Every event is also logged server-side as a
        TRACE line so we can watch what the LLM actually does and steer it.

        Uses LangGraph `astream_events` v2 — the fine-grained event stream over
        the compiled ReAct graph (model + tool nodes).
        """
        if not self._initialized:
            raise RuntimeError("Agent service not initialized. Call initialize() first.")

        logger.info("TRACE stream_message start | turns=%d last=%r",
                    len(messages), messages[-1].get("content") if messages else None)
        final_text = ""          # assembled from the answer-turn token deltas
        last_ai_content = ""     # authoritative full text from the last model turn

        try:
            async for event in self.agent.astream_events(
                {"messages": messages},
                version="v2",
            ):
                kind = event.get("event")

                if kind == "on_chat_model_start":
                    logger.info("TRACE model_start | node=%s", event.get("name"))
                    yield {"type": "thinking", "phase": "reasoning",
                           "content": "Thinking…"}

                elif kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    text = self._extract_text(getattr(chunk, "content", None))
                    # Surface any tool-call decision as a trace (Gemini's "thoughts")
                    tool_calls = getattr(chunk, "tool_calls", None) or []
                    for tc in tool_calls:
                        logger.info("TRACE model_tool_decision | %s", tc)
                        yield {"type": "trace", "phase": "tool_decision",
                               "name": tc.get("name"), "data": tc.get("args")}
                    if text:
                        final_text += text
                        logger.debug("TRACE token | %r", text)
                        yield {"type": "token", "content": text}

                elif kind == "on_chat_model_end":
                    output = event.get("data", {}).get("output")
                    last_ai_content = self._extract_text(getattr(output, "content", None))
                    logger.info("TRACE model_end | content=%r", last_ai_content)

                elif kind == "on_tool_start":
                    name = event.get("name")
                    args = event.get("data", {}).get("input")
                    logger.info("TRACE tool_start | %s args=%s", name, args)
                    yield {"type": "tool_call", "name": name, "data": args}

                elif kind == "on_tool_end":
                    name = event.get("name")
                    output = event.get("data", {}).get("output")
                    result = self._extract_text(getattr(output, "content", output))
                    logger.info("TRACE tool_end | %s -> %r", name, result[:500])
                    yield {"type": "tool_result", "name": name,
                           "data": result[:2000]}

            # Terminal answer: prefer the last model turn's full content,
            # fall back to the tokens we assembled. Careful extraction — never
            # trust `messages[-1]` blindly (it can be a tool message).
            answer = last_ai_content.strip() or final_text.strip()
            logger.info("TRACE stream_message done | answer_len=%d", len(answer))
            yield {"type": "ai_response", "content": answer}

        except Exception as e:  # noqa: BLE001 - surface everything to the client
            logger.exception("TRACE stream_message ERROR")
            yield {"type": "error",
                   "content": f"Agent error: {e}",
                   "data": repr(e)}

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
        return self.mcp_service.get_tool_by_name(tool_name)
    
    def list_available_tools(self) -> List[str]:
        """
        Get list of available tool names
        
        Returns:
            List of tool names
        """
        return self.mcp_service.list_available_tools()
    
    @property
    def is_initialized(self) -> bool:
        """Check if the service is initialized"""
        return self._initialized
