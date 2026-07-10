# DocuFusion Infrastructure Services

This document details the web search and scraping services available to DocFusion. These services are isolated from the data/auth infrastructure and are used for opportunity discovery, source research, page scraping, and document parsing.

## Server Overview

| Property | Value |
|----------|-------|
| **Host** | 84.247.181.100 |
| **Purpose** | Web search and scraping services |
| **Isolation** | Separate from data/auth infrastructure |
| **Public search endpoint** | `https://search.lindela.io` |

---

## Services

### 1. Firecrawl (Primary Web Scraper)

**Purpose**: High-performance web scraping with JavaScript rendering, ideal for most websites.

| Property | Value |
|----------|-------|
| **Port** | 3002 |
| **Base URL** | `http://84.247.181.100:3002` |
| **API Docs** | `http://84.247.181.100:3002/docs` |
| **pm2 name** | `firecrawl` |

**Key Endpoints**:
```bash
# Scrape a URL
POST http://84.247.181.100:3002/v1/scrape
Content-Type: application/json

{
  "url": "https://example.com",
  "formats": ["markdown", "html"]
}

# Health check
GET http://84.247.181.100:3002/health
```

**When to Use**: First choice for all web scraping. Falls back to stealth-scraper when blocked.

---

### 2. Playwright / Stealth Browser Service

**Purpose**: Headless Chromium browser service for Firecrawl with stealth anti-detection behavior. Use this path for sites that cannot be crawled through the normal Firecrawl flow.

| Property | Value |
|----------|-------|
| **Port** | 3003 |
| **Base URL** | `http://84.247.181.100:3003` |
| **Browser** | Headless Chromium |
| **Role** | Firecrawl browser backend with stealth anti-detection |

**Key Endpoints**:
```bash
# Scrape with stealth (Firecrawl-compatible API)
POST http://84.247.181.100:3003/v1/scrape
Content-Type: application/json

{
  "url": "https://protected-site.com",
  "formats": ["markdown", "extract"],
  "extract": {
    "schema": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "content": { "type": "string" }
      }
    },
    "systemPrompt": "Extract the main content"
  }
}

# Health check
GET http://84.247.181.100:3003/health
```

**When to Use**: Only when ordinary Firecrawl scraping fails or the site requires browser rendering/stealth behavior.

**Resource Usage**:
- Browser: 200-500MB RAM per instance
- LLM (granite4:350m): ~400MB RAM
- Limit concurrent scrapes to 3-5

---

### 3. SearXNG (Metasearch Engine)

**Purpose**: Privacy-respecting search aggregator that queries 100+ search engines (Google, Bing, DuckDuckGo, etc.) without API keys.

| Property | Value |
|----------|-------|
| **Port** | 8888 |
| **Base URL** | `https://search.lindela.io` |
| **Web UI** | `https://search.lindela.io` |
| **Public ingress** | Caddy on 80/443 fronts `search.lindela.io` to SearXNG `:8888` |

**Key Endpoints**:
```bash
# JSON search (for programmatic use)
GET https://search.lindela.io/search?q=your+query&format=json

# Example with categories
GET https://search.lindela.io/search?q=python+async&format=json&categories=it

# Available categories: general, images, videos, news, it, science, files, social media
```

**MCP Integration** (for opencode/Claude Code):
```json
{
  "mcp": {
    "searxng": {
      "type": "local",
      "command": ["npx", "-y", "mcp-searxng"],
      "env": {
        "SEARXNG_URL": "https://search.lindela.io"
      }
    }
  }
}
```

**When to Use**: All web search queries. Free alternative to Google/Bing APIs.

---

### 4. Docling (Document Processing)

**Purpose**: IBM's document extraction service for PDFs, DOCX, images, and scanned documents with OCR.

| Property | Value |
|----------|-------|
| **Port** | 3600 |
| **Base URL** | `http://84.247.181.100:3600` |
| **Web UI** | `http://84.247.181.100:3600/ui` |
| **API Docs** | `http://84.247.181.100:3600/docs` |
| **pm2 name** | `docling` |

**Key Endpoints**:
```bash
# Convert document to markdown
POST http://84.247.181.100:3600/v1/convert
Content-Type: multipart/form-data

# With file upload
curl -X POST http://84.247.181.100:3600/v1/convert \
  -F "file=@document.pdf" \
  -F "output_format=markdown"

# Health check
GET http://84.247.181.100:3600/health
```

**Supported Formats**:
- PDF (native and scanned with OCR)
- DOCX, DOC
- PPTX, PPT
- XLSX, XLS
- Images (PNG, JPG, TIFF)
- HTML

**When to Use**: Document ingestion pipeline, RFP parsing, extracting text from any document format.

---

### 5. Ollama (Loopback LLM Runtime)

**Purpose**: Local LLM runtime used by LiteLLM alias `ollama-local`.

| Property | Value |
|----------|-------|
| **Port** | 11434 |
| **Base URL** | `http://127.0.0.1:11434` from the connectivity host only |
| **API Docs** | `https://github.com/ollama/ollama/blob/main/docs/api.md` |

**Available Models** (on server):

| Model | Size | Purpose |
|-------|------|---------|
| `granite4:350m` | ~350MB | Fast extraction, stealth-scraper default |
| `granite4:1b` | ~1GB | General tasks |
| `granite4:3b` | ~3GB | Complex reasoning |
| `qwen3:1.7b` | ~1.7GB | Fast coding assistance |
| `qwen3:4b` | ~4GB | Better coding |
| `ministral-3:3b` | ~3GB | General purpose |
| `lfm2.5-thinking` | varies | Reasoning tasks |

**Key Endpoints**:
```bash
# Generate completion
POST http://127.0.0.1:11434/api/generate
Content-Type: application/json

{
  "model": "granite4:350m",
  "prompt": "Extract the main points from this text: ...",
  "stream": false
}

# Chat completion (OpenAI-compatible)
POST http://127.0.0.1:11434/v1/chat/completions
Content-Type: application/json

{
  "model": "granite4:3b",
  "messages": [{"role": "user", "content": "Hello"}]
}

# List models
GET http://127.0.0.1:11434/api/tags

# Pull a model
POST http://127.0.0.1:11434/api/pull
{"name": "llama3.2:3b"}
```

**Configuration**:
- `OLLAMA_KEEP_ALIVE=-1` is set to keep models warm (faster inference)
- Models are loaded on first request, then stay in memory

---

## Port Summary

| Service | Port | Protocol |
|---------|------|----------|
| Firecrawl | 3002 | HTTP |
| Stealth Scraper | 3003 | HTTP |
| SearXNG | 3500 | HTTP |
| Docling | 3600 | HTTP |
| Ollama | 11434 | HTTP |

---

## Service Management

All services are managed via pm2:

```bash
# SSH to server
# Retired Azure server note (2026-06-16): previous Azure app-server SSH target was removed.

# View all services
pm2 list

# View logs
pm2 logs firecrawl
pm2 logs stealth-scraper
pm2 logs searxng
pm2 logs docling

# Restart a service
pm2 restart firecrawl

# Stop/start
pm2 stop searxng
pm2 start searxng

# Save current process list (persists across reboots)
pm2 save

# Monitor resources
pm2 monit
```

---

## Hardware Requirements for Migration

### Current Usage (Azure VM)

| Resource | Current | Used | Available |
|----------|---------|------|-----------|
| CPU | 4 vCPUs | ~20-40% idle | 60-80% |
| RAM | 16GB | ~3GB | ~13GB |
| Disk | 123GB | ~40GB | ~83GB |

### Minimum Recommended Specs

For running all services with reasonable performance:

| Resource | Minimum | Recommended | Notes |
|----------|---------|-------------|-------|
| **CPU** | 4 cores | 8 cores | More cores = better concurrent scraping |
| **RAM** | 16GB | 32GB | LLMs are memory-hungry |
| **Disk** | 100GB SSD | 200GB NVMe | SSD required for Ollama model loading |
| **Network** | 1Gbps | 1Gbps+ | High bandwidth for scraping |

### Service-Specific Requirements

| Service | Min RAM | Min CPU | Notes |
|---------|---------|---------|-------|
| Firecrawl | 2GB | 1 core | Scales with concurrency |
| Stealth Scraper | 1GB + 500MB/browser | 1 core | Each browser = 200-500MB |
| SearXNG | 512MB | 0.5 core | Lightweight |
| Docling | 2GB | 2 cores | OCR is CPU-intensive |
| Ollama | 4GB+ | 2+ cores | Depends on model size |

### Ollama Model RAM Requirements

| Model Size | RAM Required | Notes |
|------------|--------------|-------|
| 350M-1B | 1-2GB | Can run multiple |
| 3B-4B | 4-6GB | One at a time recommended |
| 7B-8B | 8-12GB | Need 16GB+ total RAM |
| 13B+ | 16GB+ | Need 32GB+ total RAM |

### Linode/Contabo Recommendations

**Budget Option** (~$24-40/month):
- Linode 8GB or Contabo VPS S
- 4 vCPUs, 8GB RAM, 200GB SSD
- Suitable for: Light usage, small models only

**Recommended** (~$48-80/month):
- Linode 16GB or Contabo VPS M
- 6-8 vCPUs, 16GB RAM, 400GB SSD
- Suitable for: Current workload, models up to 4B

**Production** (~$96-160/month):
- Linode 32GB or Contabo VPS L
- 8-16 vCPUs, 32GB RAM, 800GB SSD
- Suitable for: Heavy usage, models up to 13B

### GPU Considerations

For faster LLM inference, consider GPU instances:
- **Linode GPU**: Not currently available
- **Contabo**: No GPU options
- **Alternatives**: RunPod, Lambda Labs, Vast.ai for GPU workloads

Without GPU, CPU inference works but is slower:
- 350M model: ~0.6s per extraction
- 3B model: ~2-5s per extraction
- 7B model: ~5-15s per extraction

---

## Environment Variables

### Local Machine (~/.config/opencode/opencode.json)

```json
{
  "mcp": {
    "searxng": {
      "env": {
        "SEARXNG_URL": "https://search.lindela.io"
      }
    }
  }
}
```

### Application (.env)

```bash
# Scraping services
FIRECRAWL_URL=http://84.247.181.100:3002
STEALTH_SCRAPER_URL=http://84.247.181.100:3003

# Search
SEARXNG_URL=https://search.lindela.io

# Document processing
DOCLING_URL=http://84.247.181.100:3600

# LLM gateway
LITELLM_URL=http://84.247.181.100:4000
```

The Redis instance on `84.247.181.100:6379` is loopback-only and belongs to Firecrawl/SearXNG rate limiting and job queues. App servers should use the shared data-host Redis for sessions, LiteLLM cache, Soketi, and app-level caching.

---

## Quick Reference

### Test All Services

```bash
# Firecrawl
curl http://84.247.181.100:3002/health

# Playwright / stealth browser service
curl http://84.247.181.100:3003/health

# SearXNG
curl "https://search.lindela.io/search?q=test&format=json" | head -100

# Docling
curl http://84.247.181.100:3600/health
```

### Common Operations

```bash
# Search the web
curl "https://search.lindela.io/search?q=python+fastapi&format=json"

# Scrape a website
curl -X POST http://84.247.181.100:3002/v1/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "formats": ["markdown"]}'

# Convert a PDF
curl -X POST http://84.247.181.100:3600/v1/convert \
  -F "file=@document.pdf"

# Run LLM inference from the connectivity host
curl -X POST http://127.0.0.1:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model": "granite4:350m", "prompt": "Hello", "stream": false}'
```

---

## Troubleshooting

### Service Not Responding

```bash
# Retired Azure server note (2026-06-16): previous Azure app-server SSH target was removed.
pm2 list                    # Check status
pm2 logs <service-name>     # Check logs
pm2 restart <service-name>  # Restart
```

### Out of Memory

```bash
free -h                     # Check RAM
pm2 monit                   # Monitor processes
# Reduce concurrent operations or upgrade server
```

### Ollama Model Not Loading

```bash
ollama list                 # Check available models
ollama pull <model-name>    # Pull if missing
# Ensure OLLAMA_KEEP_ALIVE=-1 is set
```

### SearXNG Rate Limiting

Retired Azure server note (2026-06-16): the previous Azure app-server SearXNG path was removed; use the current service host path, then:
```bash
pm2 restart searxng
```

---

## Migration Checklist

When migrating to a new server:

1. **Setup Base System**
   - [ ] Ubuntu 22.04+ LTS
   - [ ] Python 3.11+
   - [ ] Node.js 18+
   - [ ] pm2 (`npm install -g pm2`)

2. **Install Services**
   - [ ] Firecrawl (follow official docs)
   - [ ] Stealth Scraper (retired Azure server note, 2026-06-16: previous copy path was removed)
   - [ ] SearXNG (retired Azure server note, 2026-06-16: previous copy path was removed)
   - [ ] Docling (`pip install docling-serve`)
   - [ ] Ollama (`curl -fsSL https://ollama.com/install.sh | sh`)

3. **Configure Services**
   - [ ] Set ports as documented
   - [ ] Configure pm2 startup (`pm2 startup && pm2 save`)
   - [ ] Set `OLLAMA_KEEP_ALIVE=-1`
   - [ ] Open firewall ports (3002, 3003, 3500, 3600, 11434)

4. **Pull Ollama Models**
   ```bash
   ollama pull granite4:350m
   ollama pull granite4:3b
   ollama pull qwen3:4b
   ```

5. **Update Client Configuration**
   - [ ] Update IP addresses in `.env` files
   - [ ] Update MCP server URLs in opencode config
   - [ ] Test all endpoints

---

*Document last updated: February 2026*
