# ai_agent_service.py
import os
from fastapi import FastAPI, Request
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
        result = await agent.ainvoke({
            "messages": [{"role": "user", "content": user_input.message}]
        })
        return {"response": result}
    except Exception as e:
        return {"error": str(e)}
