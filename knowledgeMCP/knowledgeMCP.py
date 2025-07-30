from fastmcp import FastMCP
import requests
import json
from datetime import datetime, timedelta

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
        url = f"http://nginx/api/friend/getKnowledge/{friend_id}/page/{page}/size/{size}"
        response = requests.get(url)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        return f"Error retrieving friend knowledge: {str(e)}"


@mcp.tool()
def create_friend_knowledge(friend_id: int, fact: str, importance: int) -> str:
    """
    Create a new knowledge/fact entry for a specific friend.
    
    Args:
        friend_id: The unique ID of the friend to add knowledge for
        fact: The knowledge text/fact to store (can be memories, preferences, important info)
        importance: Priority/importance level (1-10, higher numbers = more important)
    
    Returns:
        Success message with the IDs of created knowledge entries, or error message
        
    Use this to store new facts, memories, preferences, or any important information about a friend.
    """
    try:
        url = f"http://nginx/api/friend/addKnowledge/{friend_id}"
        knowledge_data = [{
            "fact": fact,  # Maps to 'text' field via @JsonProperty("fact")
            "importance": int(importance)  # Maps to 'priority' field via @JsonProperty("importance")
        }]
        
        response = requests.post(url, json=knowledge_data)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        return f"Error creating friend knowledge: {str(e)}"


@mcp.tool()
def update_friend_knowledge(knowledge_id: int, fact: str = None, importance: int = None) -> str:
    """
    Update an existing knowledge/fact entry by its ID.
    
    Args:
        knowledge_id: The unique ID of the knowledge entry to update
        fact: New fact text (optional, leave None to keep existing)
        importance: New importance level 1-10 (optional, leave None to keep existing)
    
    Returns:
        Success message or error message
        
    Use this to modify existing knowledge entries. You can update just the fact, just the importance, or both.
    """
    try:
        # First get the existing knowledge to preserve unchanged fields
        get_url = f"http://nginx/api/friend/getKnowledgeById/{knowledge_id}"
        get_response = requests.get(get_url)
        get_response.raise_for_status()
        existing_knowledge = get_response.json()
        
        # Prepare update data, keeping existing values if not provided
        update_data = {
            "id": knowledge_id,
            "fact": fact if fact is not None else existing_knowledge.get("fact"),  # Use "fact" not "text"
            "importance": int(importance) if importance is not None else existing_knowledge.get("importance")  # Use "importance" not "priority"
        }
        
        url = "http://nginx/api/friend/updateKnowledge"
        response = requests.put(url, json=update_data)
        response.raise_for_status()
        return "Knowledge updated successfully"
    except requests.exceptions.RequestException as e:
        return f"Error updating friend knowledge: {str(e)}"


@mcp.tool()
def get_friend_analytics(friend_id: int, days_back: int = 30) -> str:
    """
    Retrieve analytics data for a specific friend showing meeting dates and experiences.
    
    Args:
        friend_id: The unique ID of the friend whose analytics to retrieve
        days_back: How many days back to retrieve data (default=30)
    
    Returns:
        JSON response containing:
        - List of meeting entries with date, experience, and hours spent
        - Raw data for calculating moving averages
        
    Use this to get information about meeting history, experiences, and time spent with a friend.
    """
    try:
        # Calculate date range
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days_back)
        
        url = f"http://nginx/api/friend/analyticsList"
        params = {
            "friendId": friend_id,
            "left": start_date.isoformat(),
            "right": end_date.isoformat()
        }
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        return f"Error retrieving friend analytics: {str(e)}"


@mcp.tool()
def calculate_friend_moving_averages(friend_id: int, days_back: int = 30) -> str:
    """
    Get exponential moving averages for friend interaction metrics.
    
    Args:
        friend_id: The unique ID of the friend to analyze
        days_back: How many days back to analyze (default=30, used for raw data only)
    
    Returns:
        JSON with pre-calculated moving averages for:
        - frequency: How often you meet
        - intensity: Quality/experience rating of meetings  
        - duration: Average time spent per meeting
        
    Note: The averages are pre-calculated daily by the chrono service for optimal performance.
    This function returns the latest cached values plus optional raw analytics data.
    """
    try:
        # Get the friend's current pre-calculated averages
        url = f"http://nginx/api/friend/shortList"
        response = requests.get(url)
        response.raise_for_status()
        friends_data = response.json()
        
        # Find the specific friend
        friend_data = None
        for friend in friends_data:
            if friend['id'] == friend_id:
                friend_data = friend
                break
        
        if not friend_data:
            return json.dumps({"error": "Friend not found"})
        
        # Get raw analytics data if requested (for additional context)
        raw_data = None
        if days_back > 0:
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=days_back)
            
            analytics_url = f"http://nginx/api/friend/analyticsList"
            params = {
                "friendId": friend_id,
                "left": start_date.isoformat(),
                "right": end_date.isoformat()
            }
            
            analytics_response = requests.get(analytics_url, params=params)
            if analytics_response.status_code == 200:
                analytics_data = analytics_response.json()
                
                # Calculate summary stats from raw data
                total_meetings = len(analytics_data)
                total_hours = sum(item['hours'] for item in analytics_data)
                avg_duration_per_meeting = total_hours / max(total_meetings, 1)
                
                # Count experience ratings
                ratings_count = {}
                for item in analytics_data:
                    rating = item['experience']
                    ratings_count[rating] = ratings_count.get(rating, 0) + 1
                
                raw_data = {
                    "period_days": days_back,
                    "total_meetings": total_meetings,
                    "total_hours": round(total_hours, 2),
                    "average_duration_per_meeting": round(avg_duration_per_meeting, 2),
                    "experience_breakdown": ratings_count
                }
        
        result = {
            "friend_id": friend_id,
            "friend_name": friend_data['name'],
            "pre_calculated_averages": {
                "frequency_ema": round(friend_data.get('averageFrequency', 0.0), 3),
                "intensity_ema": round(friend_data.get('averageExcitement', 0.0), 3),
                "duration_ema": round(friend_data.get('averageDuration', 0.0), 3)
            },
            "calculation_method": "Pre-calculated by chrono service (updated daily at midnight)",
            "raw_analytics_summary": raw_data,
            "note": "These averages use exponential moving average with experience-based alpha coefficients, calculated daily for optimal performance"
        }
        
        return json.dumps(result, indent=2)
        
    except requests.exceptions.RequestException as e:
        return f"Error retrieving moving averages: {str(e)}"
    except Exception as e:
        return f"Error processing moving averages data: {str(e)}"


@mcp.tool()
def get_friends_list(page: int = 0, size: int = 20) -> str:
    """
    Retrieve a paginated list of friends with basic information.
    
    Args:
        page: Page number (0-based, default=0 for first page)
        size: Number of friends per page (default=20, good for AI processing)
    
    Returns:
        JSON response containing:
        - List of friends with id, name, and date of birth
        - Simple format optimized for AI consumption
        
    Use this to get context about available friends before creating knowledge, 
    analytics, or when you need to reference specific friends by ID.
    Essential for understanding who the user has in their network.
    """
    try:
        url = f"http://nginx/api/friend/friends/page/{page}/size/{size}"
        response = requests.get(url)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        return f"Error retrieving friends list: {str(e)}"


if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8000, path="/knowledgeMCP/")
