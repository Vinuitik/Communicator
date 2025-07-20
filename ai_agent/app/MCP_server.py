import asyncio
import json
from typing import Any, Dict, List, Optional
import logging
from mcp.server.fastmcp import FastMCP
from mcp.server.models import InitializationOptions
from mcp.types import (
    Resource,
    Tool,
    TextContent,
    CallToolRequest,
    ListResourcesRequest,
    ListToolsRequest,
    ReadResourceRequest,
)
from .handlers.api_handler import APIHandler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastMCP server
mcp = FastMCP("API Wrapper MCP Server")

# Initialize API handler
api_handler = APIHandler()

@mcp.list_tools()
async def handle_list_tools() -> List[Tool]:
    """List available tools"""
    return [
        Tool(
            name="make_api_request",
            description="Make an API request to a specified endpoint",
            inputSchema={
                "type": "object",
                "properties": {
                    "method": {
                        "type": "string",
                        "enum": ["GET", "POST", "PUT", "DELETE"],
                        "description": "HTTP method"
                    },
                    "endpoint": {
                        "type": "string", 
                        "description": "API endpoint path"
                    },
                    "headers": {
                        "type": "object",
                        "description": "Optional headers"
                    },
                    "data": {
                        "type": "object",
                        "description": "Request payload for POST/PUT"
                    }
                },
                "required": ["method", "endpoint"]
            }
        )
    ]

@mcp.call_tool()
async def handle_call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
    """Handle tool calls"""
    if name == "make_api_request":
        try:
            result = await api_handler.make_request(
                method=arguments.get("method"),
                endpoint=arguments.get("endpoint"),
                headers=arguments.get("headers", {}),
                data=arguments.get("data")
            )
            
            return [
                TextContent(
                    type="text",
                    text=json.dumps(result, indent=2)
                )
            ]
        except Exception as e:
            logger.error(f"API request failed: {e}")
            return [
                TextContent(
                    type="text", 
                    text=f"Error: {str(e)}"
                )
            ]
    else:
        raise ValueError(f"Unknown tool: {name}")

@mcp.list_resources()
async def handle_list_resources() -> List[Resource]:
    """List available resources"""
    return [
        Resource(
            uri="api://status",
            name="API Status",
            description="Current API wrapper status",
            mimeType="application/json"
        )
    ]

@mcp.read_resource()
async def handle_read_resource(uri: str) -> str:
    """Read resource content"""
    if uri == "api://status":
        status = await api_handler.get_status()
        return json.dumps(status, indent=2)
    else:
        raise ValueError(f"Unknown resource: {uri}")

async def main():
    """Run the MCP server"""
    # Start the server
    async with mcp.run_server() as server:
        await server.serve()

if __name__ == "__main__":
    asyncio.run(main())