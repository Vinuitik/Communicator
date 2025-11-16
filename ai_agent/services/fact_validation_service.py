"""Fact Validation Service - validates facts using AI against knowledge texts.

This service provides pure AI-based validation logic without mixing in
HTTP calls, database operations, or reference management.
"""
from typing import List, Tuple
import logging
import json

from config.settings import settings

logger = logging.getLogger(__name__)


class FactValidationService:
    """Validates facts against knowledge using AI.
    
    Features:
    - Pure validation logic (no side effects)
    - AI-based fact checking
    - Confidence threshold checking
    - Structured validation results
    """

    def __init__(self, agent_service):
        """Initialize the validation service.
        
        Args:
            agent_service: AgentService for LLM interactions
        """
        self.agent_service = agent_service
        self.min_confidence = settings.min_validation_confidence
        
        logger.info(
            f"Initialized FactValidationService - "
            f"min_confidence={self.min_confidence}"
        )

    async def validate_fact(
        self, 
        fact_key: str, 
        fact_value: str, 
        knowledge_texts: List[str]
    ) -> Tuple[bool, float, str]:
        """Validate a fact against knowledge texts using AI.
        
        Args:
            fact_key: Fact category/key (e.g., "Hobbies")
            fact_value: Fact value (e.g., "Photography, Hiking")
            knowledge_texts: List of full knowledge texts to validate against
            
        Returns:
            Tuple of (is_valid, confidence, reasoning) where:
            - is_valid: Boolean indicating if fact is supported by knowledge
            - confidence: Float between 0.0 and 1.0
            - reasoning: String explaining the validation decision
        """
        logger.info(f"Validating fact: {fact_key}: {fact_value}")
        logger.debug(f"Validating against {len(knowledge_texts)} knowledge texts")
        
        # Prepare validation prompt
        knowledge_context = "\n\n---\n\n".join(knowledge_texts)
        
        system_prompt = (
            "You are a fact validator. Your task is to determine if a fact is "
            "supported by the provided knowledge texts. Respond with a JSON object "
            "containing: {\"is_valid\": true/false, \"confidence\": 0.0-1.0, "
            "\"reasoning\": \"explanation\"}. Be strict - only mark as valid if "
            "the knowledge clearly supports the fact."
        )
        
        user_prompt = f"""
Fact to validate:
- Key: {fact_key}
- Value: {fact_value}

Knowledge texts:
{knowledge_context}

Is this fact supported by the knowledge? Provide your answer as JSON.
"""
        
        try:
            # Call AI service for validation
            response = await self.agent_service.generate_response(
                system_message=system_prompt,
                user_message=user_prompt
            )
            
            # Clean up the response - remove markdown code blocks if present
            response_clean = response.strip()
            if response_clean.startswith("```json"):
                response_clean = response_clean[7:]  # Remove ```json
            elif response_clean.startswith("```"):
                response_clean = response_clean[3:]  # Remove ```
            if response_clean.endswith("```"):
                response_clean = response_clean[:-3]  # Remove trailing ```
            response_clean = response_clean.strip()
            
            # Parse JSON response
            result = json.loads(response_clean)
            
            is_valid = result.get("is_valid", False)
            confidence = result.get("confidence", 0.0)
            reasoning = result.get("reasoning", "No reasoning provided")
            
            logger.info(
                f"Validation result: valid={is_valid}, "
                f"confidence={confidence:.2f}, "
                f"reasoning='{reasoning[:100]}...'"
            )
            
            return is_valid, confidence, reasoning
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI validation response: {e}")
            logger.error(f"Raw response: {response}")
            return False, 0.0, f"Failed to parse validation response: {str(e)}"
        except Exception as e:
            logger.error(f"AI validation failed: {str(e)}", exc_info=True)
            return False, 0.0, f"Validation error: {str(e)}"

    def meets_threshold(self, confidence: float) -> bool:
        """Check if confidence score meets the minimum threshold.
        
        Args:
            confidence: Confidence score from validation (0.0 - 1.0)
            
        Returns:
            True if confidence meets or exceeds threshold
        """
        meets = confidence >= self.min_confidence
        
        logger.debug(
            f"Confidence check: {confidence:.4f} {'≥' if meets else '<'} "
            f"{self.min_confidence} → {meets}"
        )
        
        return meets

    def get_min_confidence(self) -> float:
        """Get the minimum confidence threshold.
        
        Returns:
            Minimum confidence threshold value
        """
        return self.min_confidence
