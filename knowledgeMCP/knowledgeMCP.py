from fastmcp import FastMCP
import requests

mcp = FastMCP("KnowledgeMCP")


@mcp.tool()
def get_friend_knowledge(friend_id: int, page: int = 0, size: int = 50) -> str:
    """
    Retrieve paginated knowledge/facts about a specific friend from the knowledge database.
    
    Args:
        friend_id: The unique ID of the friend whose knowledge to retrieve
        page: Page number (0-based, default=0 for first page)
        size: Number of knowledge items per page (default=50, adjust based on needs)
    
    Returns:
        JSON response containing:
        - content: Array of knowledge objects with text, importance/priority, dates
        - totalElements: Total knowledge items for this friend
        - totalPages: Total number of pages available
        - Pagination metadata (hasNext, hasPrevious, etc.)
        
    Knowledge items are automatically sorted by importance/priority (highest first).
    Use this to get facts, memories, or important information about a friend.
    """
    try:
        url = f"http://nginx/api/friend/getKnowledge/{friend_id}/page/{page}/size/{size}" # nginx because between services
        response = requests.get(url)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        return f"Error retrieving friend knowledge: {str(e)}"

if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8000, path="/knowledgeMCP")
