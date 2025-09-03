from pathlib import Path
from typing import List, Tuple

PROMPTS_DIR = Path(__file__).parent

def load_prompt_parts(name: str) -> List[Tuple[str, str]]:
    """
    Loads prompt parts for a given prompt name.
    Expects files:
      - {name}_system.txt
      - {name}_user.txt
    Returns list of (role, text) tuples suitable for ChatPromptTemplate.from_messages.
    """
    parts = []
    system_file = PROMPTS_DIR / f"{name}_system.txt"
    user_file = PROMPTS_DIR / f"{name}_user.txt"

    if system_file.exists():
        parts.append(("system", system_file.read_text(encoding="utf-8")))
    if user_file.exists():
        parts.append(("user", user_file.read_text(encoding="utf-8")))

    return parts
