from typing import Dict, Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from .agent_service import AgentService
from utils.json_parser import fix_json_format
from prompts.prompt_manager import load_prompt_parts
from config.settings import settings
import json
import logging

# Set up logger
logger = logging.getLogger(__name__)

class KnowledgeService:
    """Service for handling knowledge-related operations"""
    
    def __init__(self, agent_service: AgentService, redis_repo=None, mongo_repo=None):
        self.agent_service = agent_service
        self.redis_repo = redis_repo
        self.mongo_repo = mongo_repo
    
    async def summarize_friend_knowledge(self, friend_id: int) -> Dict[str, Any]:
        """
        Create a knowledge summary for a friend with Redis/MongoDB caching
        
        Workflow:
        1. Check Redis for friendID key
        2. If exists, fetch summary from MongoDB
        3. If not exists, generate summary, store in MongoDB, cache friendID in Redis
        
        Args:
            friend_id: ID of the friend to summarize knowledge for
            
        Returns:
            Structured JSON summary of friend's knowledge
        """
        logger.info(f"Starting knowledge summarization for friend_id: {friend_id}")
        try:
            if not self.redis_repo or not self.mongo_repo:
                logger.error("Redis and MongoDB repositories are required but not available")
                raise RuntimeError("Redis and MongoDB repositories are required")
            
            logger.debug(f"Redis repo: {self.redis_repo}, Mongo repo: {self.mongo_repo}")
            
            # Step 1: Check Redis cache for friend_id key
            cache_key = f"friend_summary:{friend_id}"
            logger.debug(f"Checking Redis cache with key: {cache_key}")
            cached_exists = await self.redis_repo.get(cache_key)
            logger.debug(f"Redis cache result: {cached_exists}")
            
            if cached_exists:
                logger.info(f"Cache hit for friend_id: {friend_id}, fetching from MongoDB")
                # Step 2: Fetch from MongoDB
                summary_doc = await self.mongo_repo.find_one(
                    "friend_summaries", 
                    {"friend_id": friend_id}
                )
                logger.debug(f"MongoDB query result: {summary_doc}")
                if summary_doc:
                    # Remove MongoDB _id field and return
                    summary_doc.pop("_id", None)
                    logger.info(f"Successfully retrieved cached summary for friend_id: {friend_id}")
                    return summary_doc
                # If Redis key exists but MongoDB doc missing, fall through to regenerate
                logger.warning(f"Redis key exists but MongoDB document missing for friend_id: {friend_id}")
            else:
                logger.info(f"No cache found for friend_id: {friend_id}, generating new summary")
            
            # Step 3: Generate new summary
            # Get friend knowledge using MCP tool
            logger.debug("Getting knowledge tool from agent service")
            get_knowledge_tool = self.agent_service.get_tool_by_name("get_friend_knowledge")
            if not get_knowledge_tool:
                logger.error("get_friend_knowledge tool not found in agent service")
                raise ValueError("get_friend_knowledge tool not found")
            
            logger.debug(f"Found knowledge tool: {get_knowledge_tool}")
            
            # Call the MCP tool to get knowledge
            logger.info(f"Calling get_friend_knowledge tool for friend_id: {friend_id}")
            knowledge_result = await get_knowledge_tool.ainvoke({
                "friend_id": friend_id,
                "page": 0,
                "size": settings.knowledge_max_items_per_request  # Use config value
            })
            logger.debug(f"Knowledge tool result type: {type(knowledge_result)}")
            logger.debug(f"Knowledge tool result: {knowledge_result}")
            
            # Create summarization chain
            logger.debug("Creating summarization prompt")
            summarization_prompt = self._create_summarization_prompt()
            logger.debug(f"Summarization prompt created: {summarization_prompt}")
            
            chain = (
                summarization_prompt 
                | self.agent_service.llm 
                | StrOutputParser() 
                | fix_json_format
            )
            logger.debug("Created summarization chain")
            
            # Generate summary
            logger.info("Generating summary using LLM chain")
            summary_result = await chain.ainvoke({"knowledge_data": knowledge_result})
            logger.debug(f"Summary result type: {type(summary_result)}")
            logger.debug(f"Summary result: {summary_result}")
            
            # Step 4: Store in MongoDB
            logger.info(f"Storing summary in MongoDB for friend_id: {friend_id}")
            summary_doc = {
                "friend_id": friend_id,
                "summary": summary_result,
                "generated_at": None  # You can add timestamp if needed
            }
            logger.debug(f"Summary document to store: {summary_doc}")
            await self.mongo_repo.insert_one("friend_summaries", summary_doc)
            logger.info(f"Successfully stored summary in MongoDB for friend_id: {friend_id}")
            
            # Step 5: Cache friendID in Redis permanently (no expiry)
            logger.info(f"Caching friend_id in Redis with key: {cache_key}")
            await self.redis_repo.set(cache_key, "cached")  # Permanent cache - no TTL
            logger.info(f"Successfully cached summary for friend_id: {friend_id}")
            
            logger.info(f"Knowledge summarization completed successfully for friend_id: {friend_id}")
            return summary_result
            
        except Exception as e:
            logger.error(f"Error in knowledge summarization for friend_id {friend_id}: {str(e)}", exc_info=True)
            raise RuntimeError(f"Error in knowledge summarization: {str(e)}")
    
    def _create_summarization_prompt(self) -> ChatPromptTemplate:
        """
        Create the prompt template for knowledge summarization
        
        Returns:
            ChatPromptTemplate for summarizing friend knowledge
        """
        logger.debug("Loading prompt parts for knowledge_summary")
        messages = load_prompt_parts("knowledge_summary")
        logger.debug(f"Loaded prompt messages: {messages}")
        
        if not messages:
            # Fallback to inline prompt if files are missing
            logger.warning("No prompt messages found, using fallback inline prompt")
            return ChatPromptTemplate.from_messages([
                ("system", "You are an expert at analyzing personal knowledge and creating structured summaries.\n\nReturn ONLY a JSON object."),
                ("user", "Analyze this friend knowledge data and create a structured summary:\n\n{knowledge_data}")
            ])
        
        logger.debug("Successfully created prompt template from loaded messages")
        return ChatPromptTemplate.from_messages(messages)
    
    def get_available_knowledge_tools(self) -> list:
        """
        Get list of available knowledge-related tools
        
        Returns:
            List of knowledge tool names
        """
        all_tools = self.agent_service.list_available_tools()
        knowledge_tools = [tool for tool in all_tools if 'knowledge' in tool.lower()]
        return knowledge_tools
