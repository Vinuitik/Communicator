from fastmcp import FastMCP

mcp = FastMCP("KnowledgeMCP")

@mcp.tool()
def process_knowledge_request(request: str) -> str:
    """Process a knowledge request"""
    return f"Processing knowledge request: {request}"

if __name__ == "__main__":
    mcp.run(transport = "streamable-http", host = "127.0.0.1", port = 8000, path = "/knowledgeMCP")