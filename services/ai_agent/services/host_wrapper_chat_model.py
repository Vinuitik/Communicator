"""Minimal LangChain chat model wrapping host-wrapper's /complete endpoint.

host-wrapper isn't LangChain-native — it's a plain REST gateway (prompt +
system in, text out) that fans out across gemini/github/mistral/groq/
deepseek/anthropic with failover (see host-wrapper/llm_router.py). It has no
native tool-calling API. Rather than extend host-wrapper's HTTP surface to
pass through provider-specific tool-calling formats, agent_service.py uses
the classic prompt-based ReAct agent (langchain_classic.agents) for BOTH
ollama and cloud mode, which only needs plain text generation — so this
wrapper only needs to implement _agenerate, nothing tool-call-specific.
"""
from typing import Any, List, Optional

import aiohttp
from langchain_core.callbacks.manager import AsyncCallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult


class HostWrapperChatModel(BaseChatModel):
    """Routes chat completions through host-wrapper's multi-provider fanout."""

    base_url: str
    timeout: int = 120

    @property
    def _llm_type(self) -> str:
        return "host-wrapper"

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager=None,
        **kwargs: Any,
    ) -> ChatResult:
        raise NotImplementedError(
            "HostWrapperChatModel only supports async use (ainvoke/astream)"
        )

    async def _agenerate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        system, prompt = self._to_prompt(messages)
        payload = {"prompt": prompt}
        if system:
            payload["system"] = system

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/complete",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=self.timeout),
            ) as resp:
                data = await resp.json()
                if resp.status != 200:
                    raise RuntimeError(
                        f"host-wrapper error ({resp.status}): {data.get('error', data)}"
                    )

        message = AIMessage(content=data["text"])
        return ChatResult(generations=[ChatGeneration(message=message)])

    @staticmethod
    def _to_prompt(messages: List[BaseMessage]) -> tuple:
        """Collapse LangChain messages into (system, prompt) — /complete is
        single-turn text completion, not a structured chat-messages API."""
        system_parts = []
        turns = []
        for m in messages:
            role = getattr(m, "type", "human")
            if role == "system":
                system_parts.append(str(m.content))
            elif role == "ai":
                turns.append(f"Assistant: {m.content}")
            else:
                turns.append(f"User: {m.content}")
        system = "\n".join(system_parts) or None
        prompt = "\n".join(turns)
        return system, prompt
