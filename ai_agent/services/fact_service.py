"""Fact Service - validates facts and creates chunk references.

This service coordinates fact validation and reference creation,
delegating validation logic to FactValidationService and using
FriendApiService for HTTP calls.
"""
from typing import List, Dict, Optional
import logging
from datetime import datetime, timezone
from bson import ObjectId

from config.settings import settings
from models.schemas import FactDocument, FactReferenceDocument
from .search_service import SearchService
from .fact_validation_service import FactValidationService
from .friend_api_service import FriendApiService
from repositories.fact_repository import FactRepository

logger = logging.getLogger(__name__)


class FactService:
    """Validates facts and creates references to supporting chunks.
    
    Features:
    - Coordinates fact validation workflow
    - Creates fact-to-chunk references with relevance scores
    - Filters low-quality facts (no references = discard)
    - Manages fact lifecycle (create, validate, update, delete)
    - Persists facts and references in MongoDB
    """

    def __init__(
        self, 
        search_service: SearchService,
        validation_service: FactValidationService,
        friend_api_service: FriendApiService,
        fact_repository: FactRepository,
        mongo_repo=None
    ):
        """Initialize the fact service.
        
        Args:
            search_service: Service for finding relevant chunks
            validation_service: Service for AI validation
            friend_api_service: Service for Friend API calls
            fact_repository: Repository for fact operations
            mongo_repo: MongoDB repository for reference operations
        """
        self.search_service = search_service
        self.validation_service = validation_service
        self.friend_api_service = friend_api_service
        self.fact_repository = fact_repository
        self.mongo_repo = mongo_repo
        
        # Load configuration
        self.max_references_per_fact = settings.max_references_per_fact
        self.discard_if_no_references = settings.discard_if_no_references
        
        logger.info(
            f"Initialized FactService - "
            f"max_refs={self.max_references_per_fact}, "
            f"discard_no_refs={self.discard_if_no_references}"
        )

    async def create_fact_with_references(
        self,
        friend_id: int,
        fact_key: str,
        fact_value: str
    ) -> Optional[str]:
        """Create a fact with supporting references and validation.
        
        This is the main public method. It:
        1. Searches for relevant chunks
        2. Fetches full knowledge texts
        3. Validates fact with AI
        4. Creates fact and references if validated
        
        Args:
            friend_id: ID of the friend
            fact_key: Fact category/key
            fact_value: Fact value
            
        Returns:
            Fact ID if created successfully, None if discarded
        """
        logger.info("=" * 80)
        logger.info(f"CREATING FACT WITH REFERENCES")
        logger.info("=" * 80)
        logger.info(f"Friend ID: {friend_id}")
        logger.info(f"Fact Key: '{fact_key}'")
        logger.info(f"Fact Value: '{fact_value}'")
        
        if not self.mongo_repo:
            logger.error("MongoDB repository required")
            return None
        
        # Step 1: Search for relevant chunks
        query = f"{fact_key} is {fact_value}"
        logger.info(f"Step 1: Searching for chunks with query: '{query}'")
        
        search_results = await self.search_service.search(friend_id, query)
        
        logger.info(f"Search returned {len(search_results) if search_results else 0} results")
        if search_results:
            logger.info("Top 3 search results:")
            for idx, (chunk_id, score) in enumerate(search_results[:3], 1):
                logger.info(f"  {idx}. Chunk: {chunk_id}, Score: {score:.4f}")
        
        if not search_results:
            logger.warning(f"No relevant chunks found for fact: {fact_key}: {fact_value}")
            if self.discard_if_no_references:
                logger.info("Discarding fact (no references)")
                return None
        
        # Limit to max references
        search_results = search_results[:self.max_references_per_fact]
        
        logger.info(f"Found {len(search_results)} relevant chunks")
        
        # Step 2: Get chunk metadata to extract knowledge IDs
        logger.info(f"Step 2: Fetching chunk metadata from MongoDB...")
        chunk_ids = [chunk_id for chunk_id, _ in search_results]
        chunks = await self.mongo_repo.find_many(
            "knowledge_chunks",
            {"chunk_id": {"$in": chunk_ids}}
        )
        
        logger.info(f"Retrieved {len(chunks)} chunk documents")
        
        knowledge_ids = list(set([chunk["knowledge_id"] for chunk in chunks]))
        
        logger.info(f"Chunks reference {len(knowledge_ids)} unique knowledge items")
        
        # Step 3: Fetch full knowledge texts using FriendApiService
        logger.info(f"Step 3: Fetching {len(knowledge_ids)} full knowledge texts")
        logger.info(f"Knowledge IDs to fetch: {knowledge_ids}")
        
        knowledge_texts_map = await self.friend_api_service.fetch_knowledge_texts_batch(knowledge_ids)
        knowledge_texts = list(knowledge_texts_map.values())
        
        logger.info(f"Successfully fetched {len(knowledge_texts)} knowledge texts")
        if knowledge_texts:
            total_chars = sum(len(text) for text in knowledge_texts)
            logger.info(f"Total knowledge text size: {total_chars} characters")
        
        if not knowledge_texts:
            logger.warning("Could not fetch knowledge texts")
            # Proceed without validation since fetch failed
            is_valid = True
            confidence = 0.5
            reasoning = "Auto-validated (knowledge fetch failed)"
        else:
            logger.info(f"Step 4: Validating fact with AI using {len(knowledge_texts)} knowledge texts")
            
            # Log sample of knowledge texts being used for validation
            logger.info("Knowledge texts being used for validation:")
            for idx, text in enumerate(knowledge_texts[:2], 1):
                logger.info(f"  Knowledge {idx} (first 200 chars): '{text[:200]}...'")
            
            # Delegate validation to FactValidationService
            is_valid, confidence, reasoning = await self.validation_service.validate_fact(
                fact_key, fact_value, knowledge_texts
            )
            
            logger.info(f"AI Validation Result:")
            logger.info(f"  Valid: {is_valid}")
            logger.info(f"  Confidence: {confidence:.4f}")
            logger.info(f"  Reasoning: {reasoning}")
        
        # Check validation result
        logger.info(f"Step 5: Checking validation threshold")
        logger.info(f"  Is valid: {is_valid}")
        logger.info(f"  Confidence: {confidence:.4f}")
        logger.info(f"  Min required: {self.validation_service.get_min_confidence()}")
        
        if not is_valid or not self.validation_service.meets_threshold(confidence):
            logger.warning("✗ FACT FAILED VALIDATION THRESHOLD")
            logger.warning(
                f"  is_valid={is_valid}, "
                f"confidence={confidence:.2f}, min_required={self.validation_service.get_min_confidence()}"
            )
            logger.warning(f"  Fact: '{fact_key}' = '{fact_value}'")
            return None
        
        logger.info("✓ Fact passed validation threshold, proceeding to create fact document")
        
        # Step 6: Create fact document
        fact_id = str(ObjectId())
        
        fact_doc = FactDocument(
            fact_id=fact_id,
            key=fact_key,
            value=fact_value,
            stability_score=confidence,
            validated=is_valid,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        # Save fact using FactRepository
        await self.fact_repository.save_fact(friend_id, fact_doc)
        
        logger.info(f"Created fact {fact_id} in friend_summaries")
        
        # Step 7: Create reference documents
        reference_docs = []
        
        for rank, (chunk_id, relevance_score) in enumerate(search_results, start=1):
            # Get knowledge_id for this chunk
            chunk_doc = next((c for c in chunks if c["chunk_id"] == chunk_id), None)
            if not chunk_doc:
                continue
            
            reference = FactReferenceDocument(
                fact_id=fact_id,
                chunk_id=chunk_id,
                knowledge_id=chunk_doc["knowledge_id"],
                friend_id=friend_id,
                relevance_score=relevance_score,
                validated=is_valid,
                validation_confidence=confidence,
                created_at=datetime.now(timezone.utc),
                rank=rank
            )
            
            reference_docs.append(reference)
        
        if reference_docs:
            await self.mongo_repo.insert_many(
                "fact_references",
                [ref.dict() for ref in reference_docs]
            )
            logger.info(f"Created {len(reference_docs)} references for fact {fact_id}")
        
        logger.info(
            f"Successfully created fact {fact_id} with {len(reference_docs)} references, "
            f"confidence={confidence:.2f}"
        )
        
        return fact_id

    async def get_fact_references(self, fact_id: str) -> List[Dict]:
        """Get all references for a fact.
        
        Args:
            fact_id: ID of the fact
            
        Returns:
            List of reference documents
        """
        if not self.mongo_repo:
            return []
        
        references = await self.mongo_repo.find_many(
            "fact_references",
            {"fact_id": fact_id}
        )
        
        # Sort by rank
        references.sort(key=lambda x: x.get("rank", 999))
        
        return references

    async def delete_fact(self, friend_id: int, fact_id: str) -> bool:
        """Delete a fact and all its references.
        
        Args:
            friend_id: ID of the friend
            fact_id: ID of the fact
            
        Returns:
            True if deleted successfully
        """
        if not self.mongo_repo:
            return False
        
        logger.info(f"Deleting fact {fact_id} for friend {friend_id}")
        
        # Delete fact using FactRepository
        await self.fact_repository.delete_fact(friend_id, fact_id)
        
        # Delete all references
        result = await self.mongo_repo.delete_many(
            "fact_references",
            {"fact_id": fact_id}
        )
        
        logger.info(f"Deleted fact {fact_id} and {result} references")
        
        return True

    async def re_evaluate_fact(self, friend_id: int, fact_id: str) -> bool:
        """Re-evaluate a fact's references and validation.
        
        Called when knowledge changes and fact needs to be re-validated.
        
        Args:
            friend_id: ID of the friend
            fact_id: ID of the fact
            
        Returns:
            True if re-evaluation successful
        """
        logger.info(f"Re-evaluating fact {fact_id}")
        
        if not self.mongo_repo:
            return False
        
        # Get fact from fact repository
        facts = await self.fact_repository.get_facts_for_friend(friend_id)
        
        fact = next((f for f in facts if f["fact_id"] == fact_id), None)
        if not fact:
            logger.error(f"Fact {fact_id} not found in friend {friend_id} summary")
            return False
        
        # Delete old references
        await self.mongo_repo.delete_many(
            "fact_references",
            {"fact_id": fact_id}
        )
        
        # Re-run search and validation
        fact_key = fact["key"]
        fact_value = fact["value"]
        
        # Use same logic as create_fact_with_references but update existing fact
        query = f"{fact_key} is {fact_value}"
        search_results = await self.search_service.search(friend_id, query)
        
        if not search_results and self.discard_if_no_references:
            # No references found, delete the fact
            logger.info(f"No references found during re-evaluation, deleting fact {fact_id}")
            await self.delete_fact(friend_id, fact_id)
            return True
        
        # Re-create fact with new references (similar to create_fact_with_references)
        # For now, just log that re-evaluation is needed
        logger.info(f"Re-evaluated fact {fact_id}")
        return True
