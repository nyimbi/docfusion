# Code Style and Conventions

## Python Standards
- **Indentation**: TABS (not spaces) - overrides pyproject.toml ruff config
- **Typing**: Modern Python 3.10+ syntax: `str | None`, `list[str]`, `dict[str, Any]`
- **Async**: Use async throughout for I/O operations
- **Pydantic v2**: Strict validation with ConfigDict
  ```python
  model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
  ```
- **IDs**: Use `from uuid_extensions import uuid7str` + `id: str = Field(default_factory=uuid7str)`
- **Logging**: Use `_log_` prefixed methods (e.g., `def _log_pretty_path(path: Path) -> str`)
- **Runtime Assertions**: At function start/end for constraint enforcement

## File Organization
- **Main logic**: `service.py` files
- **Pydantic models**: `views.py` files (or separate files if complex)
- **Tests**: `tests/ci/` for CI auto-discovery

## Testing Standards
- **No mocks** except for LLM calls - use pytest fixtures with real objects
- **No decorator**: No `@pytest.mark.asyncio` needed (modern pytest-asyncio)
- **Event loop**: Use `loop = asyncio.get_event_loop()` inside tests when needed
- **Command**: `uv run pytest -vxs tests/ci`

## Type Checking
- **MyPy**: Strict mode enforced
- **Command**: `uv run pyright` or `uv run mypy`

## Linting/Formatting
- **Ruff**: Fast linter replacing black, isort, flake8
- **Quote style**: Double quotes
- **Docstring**: Google style
- **Max complexity**: 15 (McCabe)
- **Command**: `make format` or `uv run ruff format`

## Frontend (TypeScript/React)
- **Components**: Functional components with hooks
- **Styling**: TailwindCSS with `cn()` utility from `lib/utils`
- **State**: Zustand for global, React Query for server state
- **Forms**: React Hook Form with Zod validation
- **Naming**: camelCase for variables, PascalCase for components

## Important Rules
1. Complete implementations — no TODOs, no placeholders, no stubs
2. Build only what's asked (YAGNI)
3. Root cause analysis for failures
4. Read before Write/Edit
5. One edit per concept, minimal diffs
6. Comments only for non-obvious logic