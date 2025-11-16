"""Summary Prompt Service - manages prompts for knowledge summarization.

This service handles prompt creation, LLM invocation for summarization,
and fact extraction from LLM responses.
"""
from typing import Dict, Any, List, Tuple
import logging

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from prompts.prompt_manager import load_prompt_parts
from utils.json_parser import fix_json_format

logger = logging.getLogger(__name__)


class SummaryPromptService:
    """Manages prompts for knowledge summarization and fact extraction.
    
    Features:
    - Loads prompt templates from files
    - Generates LLM summaries
    - Parses summaries into structured facts
    - Validates fact quality
    """

    def __init__(self):
        """Initialize the summary prompt service."""
        logger.info("Initialized SummaryPromptService")

    def create_summarization_prompt(self) -> ChatPromptTemplate:
        """Create the prompt template for knowledge summarization.
        
        Loads prompts from:
        - prompts/knowledge_summary_system.txt
        - prompts/knowledge_summary_user.txt
        
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

    async def generate_summary(
        self, 
        knowledge_data: List[Dict[str, Any]],
        llm: Any
    ) -> Dict[str, Any]:
        """Generate a summary using LLM from knowledge data.
        
        Args:
            knowledge_data: List of knowledge items from Friend API
            llm: Language model instance from agent_service
            
        Returns:
            Parsed JSON summary from LLM
        """
        logger.info("=" * 80)
        logger.info("GENERATING LLM SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Input knowledge items: {len(knowledge_data)}")
        
        # Create chain
        prompt = self.create_summarization_prompt()
        chain = prompt | llm | StrOutputParser() | fix_json_format
        
        # Generate summary
        summary_result = await chain.ainvoke({"knowledge_data": knowledge_data})
        
        logger.info("=" * 80)
        logger.info("LLM SUMMARY GENERATION COMPLETED")
        logger.info("=" * 80)
        logger.info(f"Summary result type: {type(summary_result)}")
        logger.info(f"Summary result length: {len(str(summary_result))} chars")
        logger.debug(f"Summary result content: {summary_result}")
        
        return summary_result

    def parse_summary_to_facts(self, summary_json: Dict[str, Any]) -> List[Tuple[str, str]]:
        """Parse LLM summary JSON into individual key-value fact pairs.
        
        Recursively traverses nested structures.
        Filters out empty keys and values (instant disqualification).
        
        Args:
            summary_json: The JSON summary from LLM
            
        Returns:
            List of (key, value) tuples with valid, non-empty data
        """
        logger.info("=" * 80)
        logger.info("PARSING FACTS FROM SUMMARY")
        logger.info("=" * 80)
        
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
        
        if valid_facts:
            logger.info("Sample facts (first 3):")
            for idx, (key, value) in enumerate(valid_facts[:3], 1):
                logger.info(f"  Fact {idx}: '{key}' = '{value}'")
        else:
            logger.warning("NO FACTS WERE PARSED FROM SUMMARY!")
        
        logger.info("=" * 80)
        
        return valid_facts
