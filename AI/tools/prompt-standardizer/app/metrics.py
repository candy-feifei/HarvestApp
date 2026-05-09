import re
from collections import OrderedDict


_PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


def compute_metrics(body: str) -> dict:
    char_count = len(body)
    line_count = len(body.splitlines()) if body else 0
    estimated_tokens = max(1, char_count // 4) if char_count else 0
    names = list(OrderedDict.fromkeys(_PLACEHOLDER_RE.findall(body)))
    return {
        "char_count": char_count,
        "line_count": line_count,
        "estimated_tokens": estimated_tokens,
        "placeholder_names": names,
    }


def render_template(body: str, variables: dict[str, str]) -> str:
    def repl(m: re.Match) -> str:
        key = m.group(1)
        return variables.get(key, m.group(0))

    return _PLACEHOLDER_RE.sub(repl, body)
