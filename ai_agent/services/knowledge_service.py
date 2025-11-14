from typing import Dict, Any, List, Tuple, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from .agent_service import AgentService
from .referencing_service import ReferencingService
from .chunking_service import ChunkingService
from utils.json_parser import fix_json_format
from prompts.prompt_manager import load_prompt_parts
from config.settings import settings
from datetime import datetime, timezone
import json
import logging

# Set up logger
logger = logging.getLogger(__name__)

class KnowledgeService:
    """Service for handling knowledge-related operations"""
    
    def __init__(
        self, 
        agent_service: AgentService, 
        referencing_service: ReferencingService = None,
        chunking_service: ChunkingService = None,
        redis_repo=None, 
        mongo_repo=None
    ):
        self.agent_service = agent_service
        self.referencing_service = referencing_service
        self.chunking_service = chunking_service
        self.redis_repo = redis_repo
        self.mongo_repo = mongo_repo
    
    async def summarize_friend_knowledge(self, friend_id: int) -> Dict[str, Any]:
        """
        Create a knowledge summary for a friend with Redis/MongoDB caching.
        Now uses fact-based storage with validation and references.
        
        Workflow:
        1. Check Redis for friendID key
        2. If exists, fetch facts from MongoDB
        3. If not exists:
           - Generate LLM summary
           - Parse into key-value facts
           - Validate each fact with ReferencingService
           - Store validated facts in MongoDB
           - Cache friendID in Redis
        
        Args:
            friend_id: ID of the friend to summarize knowledge for
            
        Returns:
            Structured facts with references
        """
        logger.info(f"Starting knowledge summarization for friend_id: {friend_id}")
        try:
            if not self.redis_repo or not self.mongo_repo:
                logger.error("Redis and MongoDB repositories are required but not available")
                raise RuntimeError("Redis and MongoDB repositories are required")
            
            # Step 1: Check Redis cache for friend_id key
            cache_key = f"friend_summary:{friend_id}"
            logger.debug(f"Checking Redis cache with key: {cache_key}")
            cached_exists = await self.redis_repo.get(cache_key)
            
            if cached_exists:
                logger.info(f"Cache hit for friend_id: {friend_id}, fetching facts from MongoDB")
                # Fetch facts with references
                return await self.get_friend_facts_with_references(friend_id)
            
            logger.info(f"No cache found for friend_id: {friend_id}, generating new summary")
            
            # Step 2: Get friend knowledge using MCP tool
            logger.debug("Getting knowledge tool from agent service")
            get_knowledge_tool = self.agent_service.get_tool_by_name("get_friend_knowledge")
            if not get_knowledge_tool:
                logger.error("get_friend_knowledge tool not found in agent service")
                raise ValueError("get_friend_knowledge tool not found")
            
            # Call the MCP tool to get knowledge
            logger.info(f"Calling get_friend_knowledge tool for friend_id: {friend_id}")
            knowledge_result = await get_knowledge_tool.ainvoke({
                "friend_id": friend_id,
                "page": 0,
                "size": settings.knowledge_max_items_per_request
            })
            logger.debug(f"Knowledge tool result: {knowledge_result}")
            
            # Step 3: Create summarization chain and generate summary
            logger.debug("Creating summarization prompt")
            summarization_prompt = self._create_summarization_prompt()
            
            chain = (
                summarization_prompt 
                | self.agent_service.llm 
                | StrOutputParser() 
                | fix_json_format
            )
            
            # Generate summary
            logger.info("Generating summary using LLM chain")
            summary_result = await chain.ainvoke({"knowledge_data": knowledge_result})
            logger.debug(f"Summary result: {summary_result}")
            
            # Step 4: Parse summary into individual facts
            facts = self._parse_summary_to_facts(summary_result)
            logger.info(f"Parsed {len(facts)} facts from summary")
            
            if not facts:
                logger.warning(f"No valid facts extracted for friend {friend_id}")
                # Store empty summary
                await self.mongo_repo.update_one(
                    "friend_summaries",
                    {"friend_id": friend_id},
                    {
                        "$set": {
                            "facts": [],
                            "last_updated": datetime.now(timezone.utc),
                            "fact_count": 0
                        }
                    },
                    upsert=True
                )
                await self.redis_repo.set(cache_key, "cached")
                return {
                    "friend_id": friend_id,
                    "facts": [],
                    "fact_count": 0,
                    "last_updated": datetime.now(timezone.utc)
                }
            
            # Step 5: Validate each fact and create references
            validated_fact_ids = []
            
            if self.referencing_service:
                logger.info(f"Validating {len(facts)} facts with ReferencingService")
                
                for fact_key, fact_value in facts:
                    try:
                        fact_id = await self.referencing_service.create_fact_with_references(
                            friend_id=friend_id,
                            fact_key=fact_key,
                            fact_value=fact_value
                        )
                        
                        if fact_id:
                            validated_fact_ids.append(fact_id)
                            logger.debug(f"Validated fact: {fact_key} = {fact_value}")
                        else:
                            logger.debug(f"Fact discarded (validation failed): {fact_key} = {fact_value}")
                    
                    except Exception as e:
                        logger.error(f"Error validating fact {fact_key}: {e}")
                        continue
                
                logger.info(f"Successfully validated {len(validated_fact_ids)}/{len(facts)} facts")
            else:
                logger.warning("ReferencingService not available, facts stored without validation")
                # Fallback: store facts without validation (legacy mode)
                # This shouldn't happen in production but provides graceful degradation
                pass
            
            # Step 6: Cache friendID in Redis permanently
            logger.info(f"Caching friend_id in Redis with key: {cache_key}")
            await self.redis_repo.set(cache_key, "cached")
            
            # Step 7: Return facts with references
            result = await self.get_friend_facts_with_references(friend_id)
            
            logger.info(
                f"Knowledge summarization completed successfully for friend_id: {friend_id} "
                f"- {result['fact_count']} validated facts"
            )
            return result
            
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
    
    def _parse_summary_to_facts(self, summary_json: Dict[str, Any]) -> List[Tuple[str, str]]:
        """
        Parse LLM summary JSON into individual key-value fact pairs.
        Recursively traverses nested structures (like frontend does).
        Filters out empty keys and values (instant disqualification).
        
        Args:
            summary_json: The JSON summary from LLM
            
        Returns:
            List of (key, value) tuples with valid, non-empty data
        """
        facts = []
        
        def extract_facts(data, parent_key=""):
            """Recursively extract facts from nested JSON"""
            if isinstance(data, dict):
                for key, value in data.items():
                    # Skip error keys or null values
                    if key == "error" or value is None:
                        continue
                    
                    # Build hierarchical key if nested
                    full_key = f"{parent_key} > {key}" if parent_key else key
                    
                    if isinstance(value, dict):
                        # Recurse into nested object
                        extract_facts(value, full_key)
                    elif isinstance(value, list):
                        # Handle arrays (join as comma-separated string)
                        if value:
                            value_str = ", ".join(str(v) for v in value if v)
                            if value_str.strip():
                                facts.append((full_key, value_str))
                    else:
                        # Leaf value - validate before adding
                        value_str = str(value).strip()
                        if value_str:  # INSTANT DISQUALIFICATION for empty values
                            facts.append((full_key, value_str))
            
            elif isinstance(data, str):
                # Top-level string (shouldn't happen but handle it)
                if data.strip() and parent_key:
                    facts.append((parent_key, data.strip()))
        
        # Start extraction
        extract_facts(summary_json)
        
        # Filter out facts with empty keys (final safety check)
        valid_facts = [
            (key.strip(), value) 
            for key, value in facts 
            if key and key.strip() and value and value.strip()
        ]
        
        logger.info(f"Extracted {len(valid_facts)} valid facts from summary")
        return valid_facts
    
    async def _fetch_full_knowledge_text(self, knowledge_id: int) -> Optional[str]:
        """
        Fetch full knowledge text for a given knowledge ID from Java Friend service.
        
        Calls GET /getKnowledgeText/{id} endpoint.
        
        Args:
            knowledge_id: ID of the knowledge item
            
        Returns:
            Full knowledge text or None if not found
        """
        import aiohttp
        from config.settings import settings
        
        base_url = settings.friend_service_url
        timeout = settings.friend_service_timeout
        url = f"{base_url}/getKnowledgeText/{knowledge_id}"
        
        logger.debug(f"Fetching knowledge text for ID {knowledge_id} from {url}")
        
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout)) as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        knowledge_item = await response.json()
                        # Response format: {"id": "123", "text": "..."}
                        text = knowledge_item.get("text")
                        if text:
                            logger.debug(f"Retrieved knowledge text for ID {knowledge_id} ({len(text)} chars)")
                            return text
                        else:
                            logger.warning(f"Knowledge {knowledge_id} has no text content")
                            return None
                    elif response.status == 404:
                        logger.warning(f"Knowledge {knowledge_id} not found")
                        return None
                    else:
                        error_text = await response.text()
                        logger.error(
                            f"Failed to fetch knowledge {knowledge_id}: "
                            f"HTTP {response.status} - {error_text}"
                        )
                        return None
        except aiohttp.ClientError as e:
            logger.error(f"Network error fetching knowledge {knowledge_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching knowledge {knowledge_id}: {e}")
            return None
    
    async def get_friend_facts_with_references(self, friend_id: int) -> Dict[str, Any]:
        """
        Get all facts for a friend with embedded reference information.
        Includes chunk texts for frontend tooltip display.
        
        Args:
            friend_id: ID of the friend
            
        Returns:
            Dictionary with facts and their references
        """
        logger.info(f"Fetching facts with references for friend {friend_id}")
        
        if not self.mongo_repo:
            raise RuntimeError("MongoDB repository required")
        
        # Fetch friend summary
        summary_doc = await self.mongo_repo.find_one(
            "friend_summaries",
            {"friend_id": friend_id}
        )
        
        if not summary_doc or "facts" not in summary_doc:
            logger.warning(f"No facts found for friend {friend_id}")
            return {
                "friend_id": friend_id,
                "facts": [],
                "fact_count": 0,
                "last_updated": None
            }
        
        facts_with_refs = []
        
        # For each fact, fetch references and reconstruct chunk texts
        for fact in summary_doc.get("facts", []):
            fact_id = fact.get("fact_id")
            
            # Fetch references for this fact
            references = await self.mongo_repo.find(
                "fact_references",
                {"fact_id": fact_id}
            )
            
            # Sort by rank
            references.sort(key=lambda x: x.get("rank", 999))
            
            # Reconstruct chunk texts for each reference
            enriched_references = []
            for ref in references:
                chunk_id = ref.get("chunk_id")
                knowledge_id = ref.get("knowledge_id")
                
                # Fetch chunk metadata
                chunk_doc = await self.mongo_repo.find_one(
                    "knowledge_chunks",
                    {"chunk_id": chunk_id}
                )
                
                if not chunk_doc:
                    logger.warning(f"Chunk {chunk_id} not found")
                    continue
                
                # Fetch full knowledge text
                full_text = await self._fetch_full_knowledge_text(knowledge_id)
                
                if full_text and self.chunking_service:
                    # Reconstruct chunk text from positions
                    try:
                        chunk_text = await self.chunking_service.get_chunk_text(
                            chunk_id, 
                            full_text
                        )
                    except Exception as e:
                        logger.warning(f"Failed to reconstruct chunk text: {e}")
                        chunk_text = "[Text unavailable]"
                else:
                    chunk_text = "[Full knowledge text not available]"
                
                enriched_references.append({
                    "chunk_id": chunk_id,
                    "knowledge_id": knowledge_id,
                    "chunk_text": chunk_text,
                    "relevance_score": ref.get("relevance_score", 0.0),
                    "rank": ref.get("rank", 0)
                })
            
            # Add references to fact
            fact_with_refs = {
                "fact_id": fact_id,
                "key": fact.get("key"),
                "value": fact.get("value"),
                "stability_score": fact.get("stability_score", 0.0),
                "validated": fact.get("validated", False),
                "created_at": fact.get("created_at"),
                "updated_at": fact.get("updated_at"),
                "references": enriched_references
            }
            
            facts_with_refs.append(fact_with_refs)
        
        result = {
            "friend_id": friend_id,
            "facts": facts_with_refs,
            "fact_count": len(facts_with_refs),
            "last_updated": summary_doc.get("last_updated")
        }
        
        logger.info(f"Returning {len(facts_with_refs)} facts with references")
        return result
    
    def get_available_knowledge_tools(self) -> list:
        """
        Get list of available knowledge-related tools
        
        Returns:
            List of knowledge tool names
        """
        all_tools = self.agent_service.list_available_tools()
        knowledge_tools = [tool for tool in all_tools if 'knowledge' in tool.lower()]
        return knowledge_tools
