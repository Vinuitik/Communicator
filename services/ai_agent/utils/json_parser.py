import json
import re
from typing import Dict, Any

def fix_json_format(text: str) -> Dict[str, Any]:
    """
    Fix common JSON formatting issues and extract JSON from LLM response
    
    Args:
        text: Raw text response from LLM that should contain JSON
        
    Returns:
        Parsed JSON as dictionary, or error dict if parsing fails
    """
    try:
        # First try to parse as-is
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # Try to extract JSON from markdown code blocks
    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass
    
    # Try to find JSON object in the text
    json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass
    
    # Try to fix common issues
    cleaned_text = text.strip()
    if cleaned_text.startswith('```') and cleaned_text.endswith('```'):
        cleaned_text = cleaned_text[3:-3].strip()
        if cleaned_text.startswith('json'):
            cleaned_text = cleaned_text[4:].strip()
    
    # Replace single quotes with double quotes
    cleaned_text = re.sub(r"'([^']*)':", r'"\1":', cleaned_text)
    cleaned_text = re.sub(r":\s*'([^']*)'", r': "\1"', cleaned_text)
    
    try:
        return json.loads(cleaned_text)
    except json.JSONDecodeError:
        # Last resort: return a basic structure
        return {"error": "Could not parse JSON", "raw_response": text}
