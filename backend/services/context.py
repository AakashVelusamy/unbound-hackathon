"""Context extraction from previous step output. Full or truncate only."""
from utils.enums import ContextStrategy

# Hardcoded limit for truncate_chars (no config in UI yet)
TRUNCATE_CHARS_LIMIT = 4000


def extract_context(previous_output: str, strategy: str) -> str:
    """
    Build context string to inject into the next step's prompt.
    previous_output: raw text from the previous step's LLM response.
    strategy: 'full' or 'truncate_chars'.
    """
    if not previous_output:
        return ""
    text = previous_output.strip()
    if strategy == ContextStrategy.FULL.value:
        return text
    if strategy == ContextStrategy.TRUNCATE_CHARS.value:
        if len(text) <= TRUNCATE_CHARS_LIMIT:
            return text
        return text[:TRUNCATE_CHARS_LIMIT] + "\n\n[... truncated]"
    return text
