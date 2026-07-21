import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from models.schemas import QueryInput, ChatResponse, ErrorResponse, WebSocketMessage
from services.agent_service import AgentService
from dependencies.deps import get_agent_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


def _parse_envelope(raw: str) -> tuple[str, dict]:
    """Unwrap the client's JSON envelope into the actual user message.

    The frontend sends `JSON.stringify({type, message, friendId, ...})`. The old
    code fed that whole JSON string to the LLM. Here we extract `.message` and,
    when a `friendId` is present, prefix a compact context tag so the agent's
    tools reliably target the right friend. Falls back to the raw text if the
    payload is not JSON.
    """
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return raw, {}

    if not isinstance(payload, dict):
        return str(payload), {}

    message = payload.get("message")
    if not message:
        return raw, payload

    friend_id = payload.get("friendId")
    if friend_id is not None and payload.get("type") == "chat":
        message = f"[Active friend_id={friend_id}] {message}"
    return message, payload


# Chit-chat won't grow huge, but cap the replayed history as a cheap runaway
# guard. Always keep the first turn (the friend-context init) + the most recent.
MAX_HISTORY = 50


def _cap_history(history: list[dict]) -> list[dict]:
    if len(history) <= MAX_HISTORY:
        return history
    return history[:1] + history[-(MAX_HISTORY - 1):]

@router.post("/", response_model=ChatResponse)
async def chat_with_agent(
    user_input: QueryInput,
    agent_service: AgentService = Depends(get_agent_service)
):
    """
    Chat with the AI agent using a standard HTTP request
    
    Args:
        user_input: User's message input
        agent_service: Injected agent service
        
    Returns:
        Agent's response
    """
    try:
        result = await agent_service.process_message(user_input.message)
        return ChatResponse(response=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    agent_service: AgentService = Depends(get_agent_service)
):
    """
    WebSocket endpoint for real-time chat with the AI agent
    
    Args:
        websocket: WebSocket connection
        agent_service: Injected agent service
    """
    await websocket.accept()

    # Per-connection conversation memory. The agent graph is stateless, so we
    # replay the whole history each turn — that IS the "remember the chat" fix.
    # Lives only for this WebSocket; a reconnect (or restart) starts fresh.
    history: list[dict] = []

    try:
        while True:
            # Receive the client's JSON envelope and unwrap it to the real message
            raw = await websocket.receive_text()
            user_message, payload = _parse_envelope(raw)
            logger.info("WS recv | type=%s friendId=%s message=%r",
                        payload.get("type"), payload.get("friendId"), user_message)

            history.append({"role": "user", "content": user_message})
            history = _cap_history(history)

            try:
                # Stream lifecycle events (thinking / tool_call / token / ...)
                # instead of one opaque blob. Careful terminal extraction lives
                # in AgentService.stream_message. Capture the answer to append to
                # history so the next turn has context.
                answer = ""
                async for event in agent_service.stream_message(history):
                    if event.get("type") == "ai_response":
                        answer = event.get("content") or ""
                    await websocket.send_json(WebSocketMessage(**event).dict())

                if answer:
                    history.append({"role": "assistant", "content": answer})

            except Exception as e:
                logger.exception("WS processing error")
                error_response = WebSocketMessage(
                    type="error",
                    content=f"Error processing message: {str(e)}",
                    data=repr(e),
                )
                await websocket.send_json(error_response.dict())

    except WebSocketDisconnect:
        logger.info("Client disconnected from WebSocket")
    except Exception as e:
        logger.exception("WebSocket error")
        await websocket.close(code=1011, reason=str(e))

@router.get("/tools")
async def list_available_tools(
    agent_service: AgentService = Depends(get_agent_service)
):
    """
    Get list of available tools for the agent
    
    Args:
        agent_service: Injected agent service
        
    Returns:
        List of available tool names
    """
    try:
        tools = agent_service.list_available_tools()
        return {"tools": tools}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
