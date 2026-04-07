# Task Completion Checklist

## Definition of Done (DoD)

A task is **Done** only when ALL of the following are complete:

### 1. Code Quality
- [ ] Code compiles without errors
- [ ] Type checking passes: `uv run pyright` or `uv run mypy`
- [ ] Linting passes: `uv run ruff check` or `make lint`
- [ ] Formatting applied: `uv run ruff format` or `make format`
- [ ] No security vulnerabilities: `make security-scan`

### 2. Testing
- [ ] Unit tests written for new logic
- [ ] Integration tests for API/database changes
- [ ] All tests pass: `make test` or `uv run pytest -vxs tests/ci`
- [ ] Test coverage ≥ 80% (if applicable)

### 3. Documentation
- [ ] Code comments for non-obvious logic
- [ ] Docstrings for public functions (Google style)
- [ ] README updated (if applicable)
- [ ] API documentation updated (if applicable)

### 4. Git Hygiene
- [ ] Changes staged and committed
- [ ] Commit message follows conventional commits
- [ ] No sensitive data in commits
- [ ] Branch up to date with main

### 5. Integration
- [ ] Dependencies added via `uv add` (not manual pip install)
- [ ] Database migrations created (if schema changed)
- [ ] Environment variables documented
- [ ] Configuration files updated (if needed)

## Commands to Run Before Marking Done
```bash
# Quick quality check
make quality-check

# Or run individually:
uv run ruff format && uv run ruff check
uv run pyright
uv run pytest -vxs tests/ci

# For frontend changes
cd frontend && npm run lint && npm run build && npm run test
```

## Pre-commit Hooks
The project uses pre-commit hooks that automatically:
- Format code with Ruff
- Check types with MyPy
- Scan for security issues with Bandit
- Validate conventional commits

## Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`

Example:
```
feat(discovery): add World Bank scraper

- Implement async HTTP client with rate limiting
- Add fingerprint-based deduplication
- Include category detection for procurement types

Closes #123
```