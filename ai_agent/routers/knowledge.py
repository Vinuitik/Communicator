from fastapi import APIRouter, Depends, HTTPException
from models.schemas import SummarizeKnowledgeInput, ErrorResponse
from services.knowledge_service import KnowledgeService
from dependencies.deps import get_knowledge_service
import logging

# Set up logger
logger = logging.getLogger(__name__)

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
    logger.info(f"Received summarize request for friend_id: {input_data.friend_id}")
    logger.debug(f"Input data: {input_data}")
    logger.debug(f"Knowledge service instance: {knowledge_service}")
    
    try:
        logger.info(f"Calling knowledge service to summarize friend_id: {input_data.friend_id}")
        result = await knowledge_service.summarize_friend_knowledge(input_data.friend_id)
        logger.info(f"Successfully completed summarization for friend_id: {input_data.friend_id}")
        logger.debug(f"Result type: {type(result)}")
        return result
    except ValueError as e:
        logger.error(f"ValueError in summarize endpoint for friend_id {input_data.friend_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in summarize endpoint for friend_id {input_data.friend_id}: {str(e)}", exc_info=True)
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
