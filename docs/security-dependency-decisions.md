# Security Dependency Decisions

Last reviewed: 2026-05-18

## Python Dependencies

`uv run --extra dev pip-audit --progress-spinner off` currently reports one residual finding:

| Advisory group | Dependency path | Decision |
|---|---|---|
| `lxml` CVE-2026-41066 | `docfusion -> crawl4ai -> lxml` | No compatible fixed version is currently available through `crawl4ai`; `crawl4ai 0.8.6` declares `lxml~=5.3`, while the advisory fix starts at `lxml 6.1.0`. Keep `crawl4ai` updated and re-check this advisory on each crawler dependency refresh. |

Recent remediation tightened direct dependency lower bounds for patched `aiohttp`, `gitpython`, `nltk`, `pyjwt`, `pytest`, and `crawl4ai` releases. `python-jose` and `python-multipart` are production dependencies because FastAPI imports require them under the default install set.
