# ai_agent_service.py
import os
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from dotenv import load_dotenv

from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_google_genai import ChatGoogleGenerativeAI  # Use ChatGoogleGenerativeAI instead
from langgraph.prebuilt import create_react_agent

import asyncio


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

print(GEMINI_API_KEY)

# --- Init FastAPI ---
app = FastAPI()

# --- Define input schema ---
class QueryInput(BaseModel):
    message: str

# --- LangChain agent setup ---
@app.on_event("startup")
async def setup_agent():
    
    print(GEMINI_API_KEY)
    print("Hello world"+ GEMINI_API_KEY)
    global agent

    # 1. Connect to your MCP server
    client = MultiServerMCPClient({
        "my_mcp": {
            "transport": "streamable_http",  # or 'streamable_http', 'sse'
            "url": "http://nginx/api/mcp/knowledge/knowledgeMCP/",  # Use the correct path
            # OR, for HTTP: "url": "http://localhost:PORT/mcp"
            # add headers if your MCP requires auth
        }
    })

    tools = await client.get_tools()

    # 2. Create the Gemini LLM - Use ChatGoogleGenerativeAI with google_api_key parameter
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=GEMINI_API_KEY,
        temperature=0.7,
        transport="rest"
    )

    # 3. Build the LangChain Agent with tools
    agent = create_react_agent(llm, tools)


# --- API Route ---
@app.post("/chat")
async def chat_with_agent(user_input: QueryInput):
    try:
        print(user_input.message)
        result = await agent.ainvoke({
            "messages": [{"role": "user", "content": user_input.message}]
        })
        print(result)
        return {"response": result}
    except Exception as e:
        return {"error": str(e)}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Receive message from the client
            data = await websocket.receive_text()
            
            # Get the complete response
            result = await agent.ainvoke({
                "messages": [{"role": "user", "content": data}]
            })
            
            # Extract AI message content - it's always the last message
            ai_message_content = result['messages'][-1].content
            
            print(f"AI Response Content: {ai_message_content}")
            
            # Send the AI response to client
            await websocket.send_json({
                "type": "ai_response",
                "content": ai_message_content
            })

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")
        await websocket.close(code=1011, reason=str(e))

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")
        await websocket.close(code=1011, reason=str(e))
