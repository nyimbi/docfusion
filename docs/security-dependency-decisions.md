# Security Dependency Decisions

Last reviewed: 2026-05-19

## Python Dependencies

The default deployable install keeps the Crawl4AI stack out of production dependencies because
`crawl4ai 0.8.6` currently pins `lxml` below the patched advisory range. Install
the `crawler-ai` extra only for environments that explicitly accept that optional
scraper capability and its dependency posture.

| Advisory group | Dependency path | Decision |
|---|---|---|
| `lxml` CVE-2026-41066 | `docfusion[crawler-ai] -> crawl4ai -> lxml` | No compatible fixed version is currently available through `crawl4ai`; `crawl4ai 0.8.6` declares `lxml~=5.3`, while the advisory fix starts at `lxml 6.1.0`. The default install omits this optional stack; keep `crawl4ai` updated and re-check this advisory on each crawler dependency refresh. |

Rechecked on 2026-05-19 with `uv pip compile pyproject.toml --extra dev --upgrade-package lxml`: the resolver still selects `lxml==5.4.0` through `crawl4ai`, so forcing `lxml>=6.1.0` would require an explicit dependency override outside the package's declared compatibility range.

Recent remediation tightened default dependency lower bounds for patched `aiohttp`, `gitpython`, `nltk`, `pyjwt`, and `pytest` releases, plus the optional `crawl4ai` extra. `python-jose` and `python-multipart` are production dependencies because FastAPI imports require them under the default install set.
