from fastapi import APIRouter, Depends, HTTPException
from models.schemas import SummarizeKnowledgeInput, ErrorResponse, ChunkKnowledgeInput
from services.knowledge_service import KnowledgeService
from services.chunking_service import ChunkingService
from dependencies.deps import get_knowledge_service, get_chunking_service
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

@router.post("/chunk")
async def chunk_knowledge(
    input_data: ChunkKnowledgeInput,
    chunking_service: ChunkingService = Depends(get_chunking_service)
):
    """
    Eager chunk-trigger target — the JVM's Friend/Group/Connection
    KnowledgeService's fire a best-effort HTTP call here after their own
    add/update commits, instead of relying on lazy chunking (which only ran
    when a friend's "summarize" pipeline happened to fire).

    This must never be the reason a knowledge save fails on the JVM side —
    the JVM caller wraps its call in try/catch and doesn't wait on/retry a
    non-2xx or network failure, so errors here are logged and returned as a
    normal HTTP error status, not silently swallowed.
    """
    logger.info(
        f"Received chunk request for knowledge_id={input_data.knowledge_id} "
        f"source_type={input_data.source_type}"
    )
    try:
        chunk_ids = await chunking_service.process_knowledge(
            knowledge_id=input_data.knowledge_id,
            knowledge_text=input_data.text,
            source_type=input_data.source_type,
            friend_id=input_data.friend_id,
            group_id=input_data.group_id,
            connection_friend1_id=input_data.connection_friend1_id,
            connection_friend2_id=input_data.connection_friend2_id,
        )
        return {"knowledge_id": input_data.knowledge_id, "chunk_ids": chunk_ids, "chunk_count": len(chunk_ids)}
    except ValueError as e:
        logger.error(f"Invalid chunk request for knowledge_id {input_data.knowledge_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error chunking knowledge_id {input_data.knowledge_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error chunking knowledge: {str(e)}")


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
