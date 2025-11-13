from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from models.schemas import QueryInput, ChatResponse, ErrorResponse, WebSocketMessage
from services.agent_service import AgentService
from dependencies.deps import get_agent_service

router = APIRouter(prefix="/chat", tags=["chat"])

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
            # Receive message from the client
            data = await websocket.receive_text()
            
            try:
                # Get the complete response from agent
                result = await agent_service.process_message(data)
                
                # Extract AI message content - it's always the last message
                ai_message_content = result['messages'][-1].content
                
                print(f"AI Response Content (raw): {ai_message_content}")
                
                # Normalize content to always be a string
                # Handle complex response format (list of dicts with 'text' field)
                if isinstance(ai_message_content, list) and len(ai_message_content) > 0:
                    # Extract text from the first item in the list
                    first_item = ai_message_content[0]
                    if isinstance(first_item, dict) and 'text' in first_item:
                        text_content = first_item['text']
                    else:
                        text_content = str(first_item)
                elif isinstance(ai_message_content, str):
                    # Already a string, use as-is
                    text_content = ai_message_content
                else:
                    # Fallback for unexpected formats
                    text_content = str(ai_message_content)
                
                print(f"Normalized text content: {text_content}")
                
                # Send the AI response to client (always as a string)
                response = WebSocketMessage(
                    type="ai_response",
                    content=text_content
                )
                await websocket.send_json(response.dict())
                
            except Exception as e:
                error_response = WebSocketMessage(
                    type="error",
                    content=f"Error processing message: {str(e)}"
                )
                await websocket.send_json(error_response.dict())

    except WebSocketDisconnect:
        print("Client disconnected from WebSocket")
    except Exception as e:
        print(f"WebSocket error: {e}")
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
