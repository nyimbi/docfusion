# Technology Stack

## Backend (Python)
- **Python**: 3.10+ (up to 3.13 supported)
- **Package Manager**: UV (ultra-fast Rust-based)
- **Web Framework**: FastAPI + Flask-AppBuilder
- **Database**: PostgreSQL with SQLAlchemy 2.0+ / Alembic migrations
- **Async Database**: asyncpg for async endpoints
- **AI/ML**: OpenAI, pgai, scikit-learn, XGBoost, statsmodels
- **Document Processing**: python-docx, python-pptx, openpyxl, PyPDF2
- **Web Scraping**: crawl4ai, crawlee, cloudscraper, playwright, beautifulsoup4
- **NLP**: NLTK, transformers
- **Collaboration**: Yjs (CRDT), Pusher for real-time

## Frontend (TypeScript/React)
- **Framework**: Next.js 15 with React 19
- **Styling**: TailwindCSS 3.4, Tailwind Animate
- **Editor**: TipTap (collaborative rich text)
- **Diagrams**: Mermaid, Excalidraw
- **State**: Zustand, React Query (TanStack Query)
- **Auth**: Better Auth
- **Database**: Drizzle ORM with PostgreSQL
- **UI Components**: Radix UI primitives

## Infrastructure
- **Containerization**: Docker, docker-compose
- **Database Migrations**: Alembic
- **Pre-commit Hooks**: Ruff, MyPy, Bandit
- **Testing**: pytest, Vitest (frontend), Playwright (E2E)

## Key Dependencies (Python)
```
aiohttp, asyncpg, beautifulsoup4, cloudscraper, crawl4ai
fastapi, uvicorn, pydantic, sqlalchemy, alembic
openai, pandas, numpy, scikit-learn, xgboost
playwright, gitpython, nltk, opencv-python
```

## Key Dependencies (Frontend)
```
next, react, react-dom, tailwindcss
@tiptap/*, yjs, y-indexeddb, y-webrtc
@radix-ui/*, lucide-react, framer-motion
drizzle-orm, pg, better-auth
```