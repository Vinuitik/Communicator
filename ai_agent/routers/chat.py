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

    try:
        while True:
            # Receive the client's JSON envelope and unwrap it to the real message
            raw = await websocket.receive_text()
            user_message, payload = _parse_envelope(raw)
            logger.info("WS recv | type=%s friendId=%s message=%r",
                        payload.get("type"), payload.get("friendId"), user_message)

            try:
                # Stream lifecycle events (thinking / tool_call / token / ...)
                # instead of one opaque blob. Careful terminal extraction lives
                # in AgentService.stream_message.
                async for event in agent_service.stream_message(user_message):
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
