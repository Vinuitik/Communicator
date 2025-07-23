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
    Calculate exponential moving averages for friend interaction metrics.
    
    Args:
        friend_id: The unique ID of the friend to analyze
        days_back: How many days back to analyze (default=30)
    
    Returns:
        JSON with calculated moving averages for:
        - frequency: How often you meet
        - intensity: Quality/experience rating of meetings
        - duration: Average time spent per meeting
        
    Uses exponential moving average algorithm to smooth out fluctuations and show trends.
    """
    try:
        # Get analytics data
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
        analytics_data = response.json()
        
        if not analytics_data:
            return json.dumps({"error": "No analytics data found for this friend"})
        
        # Process the data similar to analytics.js
        feedback_by_date = {}
        total_duration_by_date = {}
        frequency_by_date = {}
        
        for item in analytics_data:
            date = item['date']
            
            # Update total duration
            total_duration_by_date[date] = total_duration_by_date.get(date, 0) + item['hours']
            
            # Update frequency (count of meetings)
            frequency_by_date[date] = frequency_by_date.get(date, 0) + 1
            
            # Update feedback (experience rating - assuming it's numeric or can be converted)
            try:
                experience_rating = float(item['experience']) if item['experience'].replace('.', '').isdigit() else 5.0
                feedback_by_date[date] = experience_rating
            except:
                feedback_by_date[date] = 5.0  # Default neutral rating
        
        # Create date range and fill missing dates with zeros
        current_date = start_date
        all_dates = []
        while current_date <= end_date:
            all_dates.append(current_date.isoformat())
            current_date += timedelta(days=1)
        
        # Map data to arrays
        frequency_data = [frequency_by_date.get(date, 0) for date in all_dates]
        intensity_data = [feedback_by_date.get(date, 0) for date in all_dates]
        duration_data = [total_duration_by_date.get(date, 0) for date in all_dates]
        
        # Calculate exponential moving averages
        def exponential_moving_average(data, window_size=7):
            if not data or len(data) == 0:
                return []
            
            alpha = 2 / (window_size + 1)
            ema = []
            previous_ema = data[0]
            
            for value in data:
                previous_ema = alpha * value + (1 - alpha) * previous_ema
                ema.append(previous_ema)
            
            return ema
        
        # Calculate EMAs
        smoothed_frequency = exponential_moving_average(frequency_data)
        smoothed_intensity = exponential_moving_average(intensity_data)
        smoothed_duration = exponential_moving_average(duration_data)
        
        # Get latest values (most recent trends)
        latest_frequency = smoothed_frequency[-1] if smoothed_frequency else 0
        latest_intensity = smoothed_intensity[-1] if smoothed_intensity else 0
        latest_duration = smoothed_duration[-1] if smoothed_duration else 0
        
        result = {
            "friend_id": friend_id,
            "analysis_period_days": days_back,
            "latest_trends": {
                "frequency_ema": round(latest_frequency, 3),
                "intensity_ema": round(latest_intensity, 3),
                "duration_ema": round(latest_duration, 3)
            },
            "raw_data": {
                "dates": all_dates,
                "frequency_ema": [round(x, 3) for x in smoothed_frequency],
                "intensity_ema": [round(x, 3) for x in smoothed_intensity],
                "duration_ema": [round(x, 3) for x in smoothed_duration]
            },
            "summary": {
                "total_meetings": sum(frequency_data),
                "average_meeting_duration": round(sum(duration_data) / max(sum(frequency_data), 1), 2),
                "average_experience_rating": round(sum(intensity_data) / max(len([x for x in intensity_data if x > 0]), 1), 2)
            }
        }
        
        return json.dumps(result, indent=2)
        
    except requests.exceptions.RequestException as e:
        return f"Error calculating moving averages: {str(e)}"
    except Exception as e:
        return f"Error processing analytics data: {str(e)}"


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
