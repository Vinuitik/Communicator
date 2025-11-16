"""Knowledge Service - orchestrates knowledge summarization workflow.

This service coordinates the entire knowledge summarization process,
delegating specific tasks to specialized services while maintaining
the high-level workflow logic.
"""
from typing import Dict, Any, List, Tuple
import logging
from datetime import datetime, timezone

from config.settings import settings
from .agent_service import AgentService
from .fact_service import FactService
from .chunking_service import ChunkingService
from .friend_api_service import FriendApiService
from .knowledge_cache_service import KnowledgeCacheService
from prompts.summary_prompt_service import SummaryPromptService
from repositories.fact_repository import FactRepository

logger = logging.getLogger(__name__)


class KnowledgeService:
    """Orchestrates knowledge summarization with fact validation.
    
    Workflow:
    1. Check cache for existing summary
    2. Fetch knowledge from Friend API
    3. Ensure knowledge is chunked (lazy chunking)
    4. Generate LLM summary using prompts
    5. Parse summary into facts
    6. Validate each fact and create references
    7. Cache result and return
    """
    
    def __init__(
        self, 
        agent_service: AgentService,
        fact_service: FactService,
        chunking_service: ChunkingService,
        friend_api_service: FriendApiService,
        cache_service: KnowledgeCacheService,
        prompt_service: SummaryPromptService,
        fact_repository: FactRepository,
        mongo_repo=None
    ):
        """Initialize the knowledge service.
        
        Args:
            agent_service: Service for LLM interactions
            fact_service: Service for fact validation and references
            chunking_service: Service for text chunking
            friend_api_service: Service for Friend API calls
            cache_service: Service for Redis caching
            prompt_service: Service for prompt management
            fact_repository: Repository for fact operations
            mongo_repo: MongoDB repository
        """
        self.agent_service = agent_service
        self.fact_service = fact_service
        self.chunking_service = chunking_service
        self.friend_api_service = friend_api_service
        self.cache_service = cache_service
        self.prompt_service = prompt_service
        self.fact_repository = fact_repository
        self.mongo_repo = mongo_repo
        
        logger.info("Initialized KnowledgeService with all dependencies")
    
    async def summarize_friend_knowledge(self, friend_id: int) -> Dict[str, Any]:
        """Create a knowledge summary for a friend with Redis/MongoDB caching.
        
        Uses fact-based storage with validation and references.
        
        Workflow:
        1. Check Redis for friendID key
        2. If exists, fetch facts from MongoDB
        3. If not exists:
           - Fetch knowledge from Friend API
           - Generate LLM summary
           - Parse into key-value facts
           - Validate each fact with FactService
           - Store validated facts in MongoDB
           - Cache friendID in Redis
        
        Args:
            friend_id: ID of the friend to summarize knowledge for
            
        Returns:
            Structured facts with references
        """
        logger.info(f"Starting knowledge summarization for friend_id: {friend_id}")
        
        try:
            # Step 1: Check cache
            logger.info("Step 1: Checking cache...")
            if await self.cache_service.is_summary_cached(friend_id):
                logger.info(f"Cache hit for friend_id: {friend_id}, fetching facts from MongoDB")
                return await self.get_friend_facts_with_references(friend_id)
            
            logger.info(f"No cache found for friend_id: {friend_id}, generating new summary")
            
            # Step 2: Fetch knowledge from Friend API
            logger.info("Step 2: Fetching knowledge from Friend API...")
            knowledge_items = await self.friend_api_service.fetch_knowledge_paginated(
                friend_id=friend_id,
                page=0,
                size=settings.knowledge_max_items_per_request
            )
            
            logger.info(f"Retrieved {len(knowledge_items)} knowledge items")
            
            if not knowledge_items:
                logger.warning(f"No knowledge items found for friend {friend_id}")
                await self.fact_repository.create_empty_summary(friend_id)
                await self.cache_service.cache_summary(friend_id)
                return {
                    "friend_id": friend_id,
                    "facts": [],
                    "fact_count": 0,
                    "last_updated": datetime.now(timezone.utc)
                }
            
            # Step 2.5: Ensure all knowledge is chunked (lazy chunking)
            logger.info("Step 2.5: Starting lazy chunking phase...")
            if self.chunking_service:
                try:
                    chunk_stats, knowledge_texts = await self._ensure_knowledge_chunked(
                        friend_id, knowledge_items
                    )
                    logger.info(f"Lazy chunking complete: {len(chunk_stats)} knowledge items processed")
                    
                    # Step 2.6: Ensure embeddings exist for all chunks
                    logger.info("Step 2.6: Ensuring embeddings exist for all chunks...")
                    all_chunk_ids = []
                    for knowledge_id in chunk_stats.keys():
                        chunks = await self.mongo_repo.find_many(
                            "knowledge_chunks",
                            {"knowledge_id": knowledge_id}
                        )
                        all_chunk_ids.extend([chunk["chunk_id"] for chunk in chunks])
                    
                    if all_chunk_ids:
                        embeddings_created = await self.chunking_service.ensure_embeddings_exist(
                            all_chunk_ids, 
                            knowledge_texts
                        )
                        logger.info(f"✓ Created {embeddings_created} new embeddings")
                    
                except Exception as e:
                    logger.error(f"Lazy chunking failed: {e}", exc_info=True)
                    logger.warning("Continuing without chunking - validation may fail")
            else:
                logger.warning("⚠️ Chunking service not available - skipping lazy chunking")
            
            # Step 3: Generate summary using SummaryPromptService
            logger.info("Step 3: Generating LLM summary...")
            summary_result = await self.prompt_service.generate_summary(
                knowledge_data=knowledge_items,
                llm=self.agent_service.llm
            )
            
            # Step 4: Parse summary into facts using SummaryPromptService
            logger.info("Step 4: Parsing facts from summary...")
            facts = self.prompt_service.parse_summary_to_facts(summary_result)
            
            if not facts:
                logger.warning(f"No valid facts extracted for friend {friend_id}")
                await self.fact_repository.create_empty_summary(friend_id)
                await self.cache_service.cache_summary(friend_id)
                return {
                    "friend_id": friend_id,
                    "facts": [],
                    "fact_count": 0,
                    "last_updated": datetime.now(timezone.utc)
                }
            
            # Step 5: Validate each fact and create references using FactService
            logger.info("=" * 80)
            logger.info("STARTING FACT VALIDATION AND REFERENCE CREATION")
            logger.info("=" * 80)
            logger.info(f"Total facts to validate: {len(facts)}")
            
            validated_fact_ids = []
            
            for fact_key, fact_value in facts:
                try:
                    fact_id = await self.fact_service.create_fact_with_references(
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
            
            # Step 6: Cache friendID in Redis
            logger.info(f"Step 6: Caching summary...")
            await self.cache_service.cache_summary(friend_id)
            
            # Step 7: Return facts with references
            result = await self.get_friend_facts_with_references(friend_id)
            
            logger.info("=" * 80)
            logger.info("KNOWLEDGE GENERATION COMPLETED")
            logger.info("=" * 80)
            logger.info(f"Friend ID: {friend_id}")
            logger.info(f"Total facts parsed: {len(facts)}")
            logger.info(f"Facts validated: {len(validated_fact_ids)}")
            logger.info(f"Facts discarded: {len(facts) - len(validated_fact_ids)}")
            logger.info(f"Final fact count in result: {result['fact_count']}")
            logger.info("=" * 80)
            
            return result
            
        except Exception as e:
            logger.error(f"Error in knowledge summarization for friend_id {friend_id}: {str(e)}", exc_info=True)
            raise RuntimeError(f"Error in knowledge summarization: {str(e)}")
    
    async def _ensure_knowledge_chunked(
        self, 
        friend_id: int, 
        knowledge_items: List[Dict[str, Any]]
    ) -> Tuple[Dict[int, int], Dict[int, str]]:
        """Ensure all knowledge items are chunked before validation (lazy chunking).
        
        Args:
            friend_id: ID of the friend
            knowledge_items: Knowledge items from Friend API
            
        Returns:
            Tuple of (chunk_stats, knowledge_texts) where:
            - chunk_stats: Dictionary mapping knowledge_id -> chunk_count
            - knowledge_texts: Dictionary mapping knowledge_id -> full_text
        """
        logger.info("=" * 80)
        logger.info("LAZY CHUNKING: Ensuring all knowledge items are chunked")
        logger.info("=" * 80)
        
        if not self.mongo_repo:
            logger.error("MongoDB repository required for lazy chunking")
            return {}, {}
        
        if not self.chunking_service:
            logger.error("Chunking service required for lazy chunking")
            return {}, {}
        
        logger.info(f"Found {len(knowledge_items)} knowledge items to check")
        
        if not knowledge_items:
            logger.warning("No knowledge items found to chunk")
            return {}, {}
        
        chunk_stats = {}
        knowledge_texts = {}
        items_needing_chunking = []
        items_already_chunked = []
        
        # Check which items need chunking
        for item in knowledge_items:
            knowledge_id = item["id"]
            
            # Fetch full knowledge text using FriendApiService
            logger.debug(f"  Fetching text for knowledge {knowledge_id}...")
            knowledge_text = await self.friend_api_service.fetch_knowledge_text(knowledge_id)
            
            if knowledge_text:
                knowledge_texts[knowledge_id] = knowledge_text
            else:
                logger.warning(f"  ❌ Failed to fetch text for knowledge {knowledge_id}")
            
            # Check if chunks exist for this knowledge item
            existing_chunks = await self.mongo_repo.find_many(
                "knowledge_chunks",
                {"knowledge_id": knowledge_id}
            )
            
            if existing_chunks:
                items_already_chunked.append(knowledge_id)
                chunk_stats[knowledge_id] = len(existing_chunks)
                logger.debug(f"  ✓ Knowledge {knowledge_id}: {len(existing_chunks)} chunks already exist")
            else:
                # Needs chunking
                logger.debug(f"  🔨 Knowledge {knowledge_id}: needs chunking")
                
                if knowledge_text:
                    items_needing_chunking.append({
                        "id": knowledge_id,
                        "text": knowledge_text
                    })
                else:
                    chunk_stats[knowledge_id] = 0
        
        logger.info(f"Chunk status: {len(items_already_chunked)} cached, {len(items_needing_chunking)} need chunking")
        
        # Chunk items that need it
        if items_needing_chunking:
            logger.info(f"Starting chunking for {len(items_needing_chunking)} knowledge items...")
            
            for idx, item in enumerate(items_needing_chunking, 1):
                knowledge_id = item["id"]
                knowledge_text = item["text"]
                
                logger.info(f"Chunking {idx}/{len(items_needing_chunking)}: knowledge_id={knowledge_id}")
                logger.debug(f"  Text preview: '{knowledge_text[:100]}...'")
                
                try:
                    chunk_ids = await self.chunking_service.process_knowledge(
                        knowledge_id=knowledge_id,
                        knowledge_text=knowledge_text,
                        force_regenerate=False
                    )
                    
                    chunk_stats[knowledge_id] = len(chunk_ids)
                    logger.info(f"  ✓ Created {len(chunk_ids)} chunks for knowledge {knowledge_id}")
                    
                except Exception as e:
                    logger.error(f"  ❌ Failed to chunk knowledge {knowledge_id}: {e}", exc_info=True)
                    chunk_stats[knowledge_id] = 0
        
        logger.info("=" * 80)
        logger.info("LAZY CHUNKING COMPLETED")
        logger.info("=" * 80)
        logger.info(f"Total knowledge items: {len(knowledge_items)}")
        logger.info(f"Already chunked: {len(items_already_chunked)}")
        logger.info(f"Newly chunked: {len(items_needing_chunking)}")
        logger.info(f"Total chunks created: {sum(chunk_stats.values())}")
        logger.info(f"Knowledge texts fetched: {len(knowledge_texts)}")
        logger.info("=" * 80)
        
        return chunk_stats, knowledge_texts
    
    async def get_friend_facts_with_references(self, friend_id: int) -> Dict[str, Any]:
        """Get all facts for a friend with embedded reference information.
        
        Includes chunk texts for frontend tooltip display.
        
        Args:
            friend_id: ID of the friend
            
        Returns:
            Dictionary with facts and their references
        """
        logger.info(f"Fetching facts with references for friend {friend_id}")
        
        if not self.mongo_repo:
            raise RuntimeError("MongoDB repository required")
        
        # Fetch friend summary using FactRepository
        summary_doc = await self.fact_repository.get_friend_summary(friend_id)
        
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
            
            # Fetch references for this fact using FactService
            references = await self.fact_service.get_fact_references(fact_id)
            
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
                
                # Fetch full knowledge text using FriendApiService
                full_text = await self.friend_api_service.fetch_knowledge_text(knowledge_id)
                
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
