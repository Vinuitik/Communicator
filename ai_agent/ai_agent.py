# ai_agent_service.py
import os
import json
import re
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from dotenv import load_dotenv

from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_google_genai import ChatGoogleGenerativeAI  # Use ChatGoogleGenerativeAI instead
from langgraph.prebuilt import create_react_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

import asyncio


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

print(GEMINI_API_KEY)

# --- Init FastAPI ---
app = FastAPI()

# --- Define input schema ---
class QueryInput(BaseModel):
    message: str

class SummarizeKnowledgeInput(BaseModel):
    friend_id: int

# --- LangChain agent setup ---
@app.on_event("startup")
async def setup_agent():
    
    print(GEMINI_API_KEY)
    print("Hello world"+ GEMINI_API_KEY)
    global agent, mcp_client, llm, tools

    # 1. Connect to your MCP server
    mcp_client = MultiServerMCPClient({
        "my_mcp": {
            "transport": "streamable_http",  # or 'streamable_http', 'sse'
            "url": "http://nginx/api/mcp/knowledge/knowledgeMCP/",  # Use the correct path
            # OR, for HTTP: "url": "http://localhost:PORT/mcp"
            # add headers if your MCP requires auth
        }
    })

    tools = await mcp_client.get_tools()

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


def fix_json_format(text: str) -> dict:
    """
    Fix common JSON formatting issues and extract JSON from LLM response
    """
    try:
        # First try to parse as-is
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # Try to extract JSON from markdown code blocks
    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass
    
    # Try to find JSON object in the text
    json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass
    
    # Try to fix common issues
    cleaned_text = text.strip()
    if cleaned_text.startswith('```') and cleaned_text.endswith('```'):
        cleaned_text = cleaned_text[3:-3].strip()
        if cleaned_text.startswith('json'):
            cleaned_text = cleaned_text[4:].strip()
    
    # Replace single quotes with double quotes
    cleaned_text = re.sub(r"'([^']*)':", r'"\1":', cleaned_text)
    cleaned_text = re.sub(r":\s*'([^']*)'", r': "\1"', cleaned_text)
    
    try:
        return json.loads(cleaned_text)
    except json.JSONDecodeError:
        # Last resort: return a basic structure
        return {"error": "Could not parse JSON", "raw_response": text}


@app.post("/summarize-knowledge")
async def summarize_friend_knowledge(input_data: SummarizeKnowledgeInput):
    """
    Create a knowledge summary for a friend using a LangChain chain
    """
    try:
        friend_id = input_data.friend_id
        
        # Step 1: Get friend knowledge using MCP tool
        get_knowledge_tool = None
        for tool in tools:
            if tool.name == "get_friend_knowledge":
                get_knowledge_tool = tool
                break
        
        if not get_knowledge_tool:
            return {"error": "get_friend_knowledge tool not found"}
        
        # Call the MCP tool to get knowledge
        knowledge_result = await get_knowledge_tool.ainvoke({
            "friend_id": friend_id,
            "page": 0,
            "size": 100  # Get more knowledge items
        })
        
        # Step 2: Create prompt template for summarization
        summarization_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert at analyzing personal knowledge and creating structured summaries.
            
Your task is to analyze the knowledge data about a friend and create a structured JSON summary.

Instructions:
1. Group similar knowledge items into logical categories
2. Extract key-value pairs that represent important facts about the friend
3. Return ONLY a valid JSON object with category-fact pairs
4. Use clear, descriptive category names
5. Keep facts concise but informative

Example format:
{
  "Favorite Food": "Caesar salad",
  "Favorite Show": "Formula One",
  "Hobbies": "Photography and hiking",
  "Work": "Software engineer at tech startup",
  "Personality": "Outgoing and adventurous"
}

Return ONLY the JSON object, no additional text or formatting."""),
            ("user", "Analyze this friend knowledge data and create a structured summary:\n\n{knowledge_data}")
        ])
        
        # Step 3: Create the chain with additional processing
        def validate_and_parse_json(text: str) -> dict:
            """Custom function to validate and parse JSON"""
            return fix_json_format(text)
        
        # Chain: Prompt → LLM → String Parser → JSON Validator
        chain = (
            summarization_prompt 
            | llm 
            | StrOutputParser() 
            | validate_and_parse_json
        )
        
        # Step 4: Run the chain (JSON parsing is now built into the chain)
        parsed_json = await chain.ainvoke({
            "knowledge_data": knowledge_result
        })
        
        return {
            "friend_id": friend_id,
            "summary": parsed_json,
            "raw_knowledge_count": len(json.loads(knowledge_result).get("content", [])) if knowledge_result else 0
        }
        
    except Exception as e:
        return {"error": str(e), "details": "Error in knowledge summarization chain"}


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
