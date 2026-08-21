import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from models.schemas import QueryInput, ChatResponse, ErrorResponse, WebSocketMessage
from services.agent_service import AgentService
from dependencies.deps import get_agent_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


# Chit-chat won't grow huge, but cap the replayed transcript as a cheap runaway
# guard. Always keep the first turn (the friend-context greeting) + the most recent.
MAX_HISTORY = 50


def _cap_history(messages: list[dict]) -> list[dict]:
    if len(messages) <= MAX_HISTORY:
        return messages
    return messages[:1] + messages[-(MAX_HISTORY - 1):]


def _normalize_messages(raw_messages: list) -> list[dict]:
    """Coerce a client transcript into clean {role, content} dicts.

    Only user/assistant text turns are kept; the client maps 'ai' → 'assistant'.
    Anything malformed is skipped rather than trusted.
    """
    out: list[dict] = []
    for m in raw_messages:
        if not isinstance(m, dict):
            continue
        role = m.get("role")
        content = m.get("content")
        if role not in ("user", "assistant") or not isinstance(content, str):
            continue
        out.append({"role": role, "content": content})
    return out


def _build_messages(payload: dict, raw: str) -> list[dict]:
    """Build the message list to feed the agent from a client WS frame.

    The chat is now CLIENT-AUTHORITATIVE: the browser stores the transcript in
    sessionStorage and replays it here every turn, so this endpoint is stateless
    (no server-side memory). Frames:
      {type:'chat',    friendId, messages:[{role,content}...]}  ← full transcript
      {type:'context', friendId, message}                       ← first-open greeting
      raw text / anything else                                  ← single user turn
    A compact `[Active friend_id=N]` tag is stamped onto the latest user turn so
    the agent's tools target the right friend.
    """
    friend_id = payload.get("friendId")
    ptype = payload.get("type")

    if ptype == "chat" and isinstance(payload.get("messages"), list):
        messages = _cap_history(_normalize_messages(payload["messages"]))
        if friend_id is not None and messages and messages[-1]["role"] == "user":
            messages[-1]["content"] = f"[Active friend_id={friend_id}] {messages[-1]['content']}"
        return messages or [{"role": "user", "content": raw}]

    # context / legacy single-message / raw text
    message = payload.get("message") or raw
    if friend_id is not None and ptype == "chat":
        message = f"[Active friend_id={friend_id}] {message}"
    return [{"role": "user", "content": message}]

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

    # Stateless: the client owns the transcript (sessionStorage) and replays it
    # each turn via `_build_messages`. No server-side memory to lose on reconnect.
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                payload = {"message": raw}
            if not isinstance(payload, dict):
                payload = {"message": str(payload)}

            messages = _build_messages(payload, raw)
            logger.info("WS recv | type=%s friendId=%s turns=%d last=%r",
                        payload.get("type"), payload.get("friendId"),
                        len(messages), messages[-1]["content"] if messages else None)

            try:
                # Stream lifecycle events (thinking / tool_call / token / ...)
                # instead of one opaque blob. Careful terminal extraction lives
                # in AgentService.stream_message.
                async for event in agent_service.stream_message(messages):
                    await websocket.send_json(WebSocketMessage(**event).dict())

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
