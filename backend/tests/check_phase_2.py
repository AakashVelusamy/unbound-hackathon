#!/usr/bin/env python3
"""Run from backend/ to verify Phase 2: criteria + optional Unbound call."""
import sys
from pathlib import Path

# Ensure backend root is on path when run as script
_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

# --- 1. Criteria (no API key needed) ---
print("Phase 2 check: Criteria evaluators")
print("-" * 40)

from services.criteria import evaluate_criteria

tests = [
    ({"type": "contains_string", "value": "SUCCESS"}, "The result is SUCCESS.", True),
    ({"type": "contains_string", "value": "SUCCESS"}, "The result is FAIL.", False),
    ({"type": "regex", "pattern": r"\d{3}-\d{4}"}, "Call 555-1234 for help.", True),
    ({"type": "regex", "pattern": r"^\d+$"}, "abc", False),
    ({"type": "has_code_block"}, "Here is code:\n```\nprint(1)\n```", True),
    ({"type": "has_code_block", "language": "python"}, "```python\nx=1\n```", True),
    ({"type": "has_code_block"}, "No code here.", False),
    ({"type": "valid_json"}, '{"a": 1}', True),
    ({"type": "valid_json"}, "not json", False),
]

ok = 0
for criteria, response, expect_pass in tests:
    passed, reason = evaluate_criteria(criteria, response)
    if passed == expect_pass:
        ok += 1
        print(f"  OK  {criteria.get('type')}: passed={passed}")
    else:
        print(f"  FAIL {criteria.get('type')}: got passed={passed}, expected {expect_pass} (reason={reason})")

print(f"Criteria: {ok}/{len(tests)} passed")
if ok != len(tests):
    sys.exit(1)

# --- 2. Unbound client (needs API key in .env) ---
print("\nPhase 2 check: Unbound client (optional)")
print("-" * 40)

from core.config import settings

if not settings.unbound_api_key:
    print("  SKIP: UNBOUND_API_KEY not set in .env")
    print("  Phase 2 criteria are OK. Set the key to test real LLM call.")
    sys.exit(0)

from services.unbound_client import call_llm

try:
    result = call_llm("Reply with exactly the word: OK", "kimi-k2p5")
    print(f"  OK  call_llm returned content length={len(result.content)}, tokens_used={result.tokens_used}")
    passed, reason = evaluate_criteria({"type": "contains_string", "value": "OK"}, result.content)
    print(f"  Criteria check (contains OK): passed={passed}" + (f", reason={reason}" if not passed else ""))
except Exception as e:
    print(f"  FAIL: {e}")
    sys.exit(1)

print("\nPhase 2 check: all good.")
