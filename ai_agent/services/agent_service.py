from typing import Optional, List, Any, Dict, AsyncIterator
from langchain_ollama import ChatOllama
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_classic.agents import create_structured_chat_agent, AgentExecutor
from config.settings import settings
from services.mcp_service import MCPService
from services.host_wrapper_chat_model import HostWrapperChatModel
import logging

# Set up logger
logger = logging.getLogger(__name__)

# Classic prompt-based structured-chat agent (not LangGraph's native-tool-
# calling agent) — deliberately, so the SAME agent works whether the LLM is
# ChatOllama (a small local model, tool-calling reliability not guaranteed)
# or HostWrapperChatModel (host-wrapper's /complete has no tool-calling API
# at all — plain text in, text out). Neither needs .bind_tools() this way.
#
# create_structured_chat_agent specifically (not the simpler create_react_agent)
# because MCP tools (via langchain-mcp-adapters) are StructuredTools with a
# JSON args_schema, not single-string inputs — the plain ReAct agent's bare
# "Action Input: <string>" format errors on those with "String tool inputs
# are not allowed when using tools with JSON schema args_schema" (hit this
# live before switching). The structured variant emits a JSON action blob
# instead, so multi-arg tool calls actually work.
_SYSTEM_PROMPT = """Respond to the human as helpfully and accurately as possible. You have access to the following tools:

{tools}

Use a json blob to specify a tool by providing an action key (tool name) and an action_input key (tool input).

Valid "action" values: "Final Answer" or {tool_names}

Provide only ONE action per $JSON_BLOB, as shown:

```
{{
    "action": $TOOL_NAME,
    "action_input": $INPUT
}}
```

Follow this format:

Question: input question to answer
Thought: consider previous and subsequent steps
Action:
```
$JSON_BLOB
```
Observation: action result
... (repeat Thought/Action/Observation N times)
Thought: I know what to respond
Action:
```
{{
    "action": "Final Answer",
    "action_input": "Final response to human"
}}
```

Begin! Reminder to ALWAYS respond with a valid json blob of a single action. Use tools if necessary. Respond directly if appropriate. Format is Action:```$JSON_BLOB```then Observation"""

_HUMAN_PROMPT = """{input}

{agent_scratchpad}

(reminder to respond in a JSON blob no matter what)"""


class AgentService:
    """Service for managing the LangChain agent and its dependencies"""

    def __init__(self, llm_settings_repo=None):
        self.agent = None
        self.mcp_service = MCPService()
        self.llm = None
        self.llm_settings_repo = llm_settings_repo
        self._initialized = False

    async def initialize(self) -> None:
        """Initialize the agent and all its dependencies"""
        if self._initialized:
            return

        print("Initializing AI Agent")

        try:
            # Initialize MCP service
            await self.mcp_service.initialize()

            # Setup LLM
            await self._setup_llm()

            # Create agent
            self._create_agent()

            self._initialized = True
            print("AI Agent initialized successfully")

        except Exception as e:
            print(f"Failed to initialize AI Agent: {e}")
            raise

    async def reload_llm(self) -> None:
        """Rebuild the LLM + agent after the mode (ollama/cloud) changes.

        Called by routers/settings.py's mode-switch endpoint. Safe to call
        anytime after initialize() — MCP tools/session are untouched, only
        the LLM and the agent wrapping it get rebuilt.
        """
        await self._setup_llm()
        self._create_agent()
        logger.info("Agent LLM reloaded")

    async def _setup_llm(self) -> None:
        """Setup the LLM per the current mode (llm_settings.mode: ollama|cloud).

        No settings repo injected -> defaults to ollama (matches the schema's
        own default) rather than failing, since some callers construct
        AgentService in contexts where DB access isn't relevant.
        """
        mode = "ollama"
        if self.llm_settings_repo is not None:
            try:
                mode = await self.llm_settings_repo.get_mode()
            except Exception as e:
                logger.warning(f"Could not read LLM mode, defaulting to ollama: {e}")

        if mode == "cloud":
            self.llm = HostWrapperChatModel(
                base_url=settings.host_wrapper_url,
                timeout=settings.host_wrapper_timeout,
            )
            print(f"LLM initialized: cloud mode via host-wrapper ({settings.host_wrapper_url})")
        else:
            self.llm = ChatOllama(
                model=settings.ollama_chat_model,
                base_url=settings.ollama_url,
                temperature=settings.llm_temperature,
            )
            print(f"LLM initialized: local mode via Ollama ({settings.ollama_chat_model})")

    def _create_agent(self) -> None:
        """Create the classic structured-chat agent with LLM and tools."""
        tools = self.mcp_service.get_tools()
        prompt = ChatPromptTemplate.from_messages([
            ("system", _SYSTEM_PROMPT),
            MessagesPlaceholder("chat_history", optional=True),
            ("human", _HUMAN_PROMPT),
        ])
        structured_agent = create_structured_chat_agent(self.llm, tools, prompt)
        self.agent = AgentExecutor(
            agent=structured_agent,
            tools=tools,
            handle_parsing_errors=True,
            # Small local models (e.g. llama3.2:3b in mode=ollama) can struggle
            # to reliably hit the strict JSON action-blob format under this
            # prompt — capped lower than the LangChain default so a model stuck
            # repeating the same formatting mistake fails fast instead of
            # burning ~10 slow CPU inference rounds before giving up anyway.
            # Cloud mode (host-wrapper, stronger models) rarely needs more
            # than 2-3 iterations for a real tool call.
            max_iterations=6,
        )
        print("Structured chat agent created successfully")

    @staticmethod
    def _format_history(messages: List[Dict[str, Any]]) -> List[Any]:
        """All but the last message, as LangChain message objects for the
        structured-chat prompt's MessagesPlaceholder("chat_history")."""
        history = []
        for m in messages[:-1]:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role in ("assistant", "ai"):
                history.append(AIMessage(content=content))
            else:
                history.append(HumanMessage(content=content))
        return history

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

        result = await self.agent.ainvoke({"input": message, "chat_history": []})

        print(f"Agent response: {result}")
        return {"output": result.get("output", "")}

    @staticmethod
    def _extract_text(content: Any) -> str:
        """Normalize message content (str, or a list of parts) to plain text."""
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

        Uses AgentExecutor's `astream_events` v2 — same LangChain Core callback
        event taxonomy LangGraph used (on_chat_model_*, on_tool_*), so this
        event-handling logic is agent-implementation-agnostic.
        """
        if not self._initialized:
            raise RuntimeError("Agent service not initialized. Call initialize() first.")

        if not messages:
            yield {"type": "error", "content": "No message provided"}
            return

        user_input = messages[-1].get("content", "")
        chat_history = self._format_history(messages)

        logger.info("TRACE stream_message start | turns=%d last=%r",
                    len(messages), user_input)
        final_text = ""          # assembled from the answer-turn token deltas
        last_ai_content = ""     # authoritative full text from the last model turn

        try:
            async for event in self.agent.astream_events(
                {"input": user_input, "chat_history": chat_history},
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
            # fall back to the tokens we assembled. The classic ReAct agent's
            # "Final Answer: ..." parsing happens inside AgentExecutor itself
            # (via its output parser) before astream_events yields the final
            # on_chat_model_end, so last_ai_content is already the raw model
            # text — AgentExecutor strips the "Final Answer:" prefix for us
            # via the chain's own output, not something we re-parse here.
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
