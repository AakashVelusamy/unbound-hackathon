"""Completion criteria evaluators — rule-based, deterministic."""
import json
import re
from typing import Any


def _get_config(criteria: dict[str, Any], key: str) -> Any:
    """Read from criteria.config.key or criteria.key (supports both shapes)."""
    config = criteria.get("config")
    if isinstance(config, dict) and key in config:
        return config[key]
    return criteria.get(key)


def evaluate_criteria(completion_criteria: dict[str, Any], response: str) -> tuple[bool, str | None]:
    """
    Evaluate response against step's completion_criteria (opaque JSON).
    Supports: { "type": "...", "value": ... } or { "type": "...", "config": { "value": ... } }.
    Returns (passed, failure_reason). failure_reason is None when passed=True.
    """
    if not isinstance(completion_criteria, dict):
        return False, "Invalid completion_criteria: not a dict"

    criteria_type = completion_criteria.get("type")
    if not criteria_type:
        return False, "Missing completion_criteria.type"

    response = response or ""

    if criteria_type == "contains_string":
        value = _get_config(completion_criteria, "value")
        if value is None:
            return False, "contains_string requires 'value'"
        if str(value) in response:
            return True, None
        return False, f"Response does not contain required string: {repr(value)[:80]}"

    if criteria_type == "regex":
        pattern = _get_config(completion_criteria, "pattern")
        if pattern is None:
            return False, "regex requires 'pattern'"
        try:
            if re.search(pattern, response, re.DOTALL):
                return True, None
        except re.error as e:
            return False, f"Invalid regex: {e}"
        return False, "Response does not match regex"

    if criteria_type == "has_code_block":
        # Simple: triple backticks only (optional language). No full Markdown parsing.
        lang = _get_config(completion_criteria, "language")
        if lang:
            pattern = rf"```\s*{re.escape(str(lang).strip())}(\s|\n|$)"
        else:
            pattern = r"```"
        if re.search(pattern, response):
            return True, None
        return False, "Response does not contain a code block (triple backticks)"

    if criteria_type == "valid_json":
        text = response.strip()
        # Try full response first
        try:
            json.loads(text)
            return True, None
        except json.JSONDecodeError:
            pass
        # Try to find first {...} or [...] and parse
        for start, end in (("{", "}"), ("[", "]")):
            i = text.find(start)
            if i == -1:
                continue
            depth = 0
            for j in range(i, len(text)):
                if text[j] == start:
                    depth += 1
                elif text[j] == end:
                    depth -= 1
                    if depth == 0:
                        try:
                            json.loads(text[i : j + 1])
                            return True, None
                        except json.JSONDecodeError:
                            break
        return False, "Response is not valid JSON"

    return False, f"Unknown completion_criteria type: {criteria_type}"
