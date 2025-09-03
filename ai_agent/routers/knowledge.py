from fastapi import APIRouter, Depends, HTTPException
from ..models.schemas import SummarizeKnowledgeInput, ErrorResponse
from ..services.knowledge_service import KnowledgeService
from ..dependencies.deps import get_knowledge_service

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

@router.post("/summarize")
async def summarize_friend_knowledge(
    input_data: SummarizeKnowledgeInput,
    knowledge_service: KnowledgeService = Depends(get_knowledge_service)
):
    """
    Create a knowledge summary for a friend using a LangChain chain
    
    Args:
        input_data: Friend ID to summarize knowledge for
        knowledge_service: Injected knowledge service
        
    Returns:
        Structured JSON summary of friend's knowledge
    """
    try:
        result = await knowledge_service.summarize_friend_knowledge(input_data.friend_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error in knowledge summarization: {str(e)}"
        )

@router.get("/tools")
async def list_knowledge_tools(
    knowledge_service: KnowledgeService = Depends(get_knowledge_service)
):
    """
    Get list of available knowledge-related tools
    
    Args:
        knowledge_service: Injected knowledge service
        
    Returns:
        List of knowledge tool names
    """
    try:
        tools = knowledge_service.get_available_knowledge_tools()
        return {"knowledge_tools": tools}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
