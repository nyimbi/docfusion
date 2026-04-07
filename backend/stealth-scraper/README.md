# Stealth Scraper Service (Camoufox + Ollama)

A Python FastAPI service for stealth web scraping with LLM-based data extraction. Uses Camoufox (stealthy Firefox fork) for anti-bot bypass and Ollama for local LLM extraction.

## Why This Service?

This is a **drop-in replacement for Firecrawl** when sites block normal scraping. It provides:

1. **Stealth Scraping**: Camoufox bypasses Cloudflare, DataDome, PerimeterX, and other anti-bot systems
2. **LLM Extraction**: Ollama extracts structured data from any page using JSON schemas
3. **Firecrawl-Compatible API**: Same request/response format as Firecrawl's `/v1/scrape`

## Why Camoufox?

| Feature | Puppeteer/Playwright | Crawlee | Camoufox |
|---------|---------------------|---------|----------|
| Fingerprint evasion | JS-level patches | JS-level patches | C++ level mods |
| Detection rate | ~20-40% | ~10-20% | **0%** |
| Geoip matching | Manual | Manual | Automatic |
| Browser base | Chromium | Chromium | Firefox |

Camoufox achieves **0% detection** on CreepJS and BrowserScan tests because modifications happen at the C++ level where JavaScript can't detect them.

## Features

- **BrowserForge fingerprints**: Mimics real-world browser distribution
- **Automatic geoip**: Timezone/locale auto-matched to proxy IP
- **Human simulation**: Realistic scrolling, delays, behavior
- **HTML to Markdown**: Clean content for LLM processing
- **LLM Extraction**: Schema-based structured data extraction via Ollama
- **Firecrawl-compatible API**: Drop-in replacement with identical request/response format

## Architecture

```
Request → Firecrawl (port 3002)
              │
              ├── Success → Return data
              │
              └── SCRAPE_ALL_ENGINES_FAILED (anti-bot)
                      │
                      ▼
              Stealth Scraper (port 3003)
                      │
                      ├── Camoufox (Firefox) → HTML/Markdown
                      │         with 0% detection
                      │
                      └── Ollama (local LLM) → Structured JSON
                                granite4:350m
```

## Installation

### 1. Create Virtual Environment

```bash
cd backend/stealth-scraper
python3 -m venv venv
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt

# Install Camoufox browser
python -m camoufox fetch
```

### 3. Run Server

```bash
# Development
python server.py

# Production with uvicorn
uvicorn server:app --host 0.0.0.0 --port 3003

# With PM2 (recommended)
pm2 start "source venv/bin/activate && python server.py" --name stealth-scraper
```

## Deployment

### Local Development
```bash
cd backend/stealth-scraper
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m camoufox fetch
python server.py
```

### Production Deployment (Azure/Linux)

**1. Copy files to server:**
```bash
scp -r backend/stealth-scraper azureuser@YOUR_SERVER:~/
```

**2. SSH and install dependencies:**
```bash
ssh azureuser@YOUR_SERVER
cd ~/stealth-scraper
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m camoufox fetch
```

**3. Install Ollama (if not present):**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull the model
ollama pull granite4:350m

# Configure keep-alive (critical for performance)
echo "OLLAMA_KEEP_ALIVE=-1" | sudo tee -a /etc/environment
sudo systemctl restart ollama
```

**4. Start with PM2 (recommended):**
```bash
# Install PM2 if needed
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'stealth-scraper',
    script: 'server.py',
    interpreter: './venv/bin/python',
    cwd: '/home/azureuser/stealth-scraper',
    env: {
      PORT: 3003,
      HOST: '0.0.0.0',
      OLLAMA_URL: 'http://localhost:11434',
      OLLAMA_MODEL: 'granite4:350m'
    }
  }]
};
EOF

# Start and save
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Auto-start on reboot
```

**5. Configure firewall (if needed):**
```bash
sudo ufw allow 3003/tcp
```

### Docker Deployment (Alternative)

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m camoufox fetch

COPY server.py .
EXPOSE 3003

CMD ["python", "server.py"]
```

```bash
docker build -t stealth-scraper .
docker run -d -p 3003:3003 \
  -e OLLAMA_URL=http://host.docker.internal:11434 \
  stealth-scraper
```

## API Reference

### POST /v1/scrape (Firecrawl-compatible)

Primary endpoint - drop-in replacement for Firecrawl's `/v1/scrape`.

**Basic Scrape Request:**
```json
{
  "url": "https://example.com",
  "formats": ["markdown"],
  "options": {
    "timeout": 60000,
    "wait_for_selector": ".content",
    "wait_after_load": 2000,
    "human_scroll": true,
    "screenshot": false,
    "block_media": true
  }
}
```

**Scrape with LLM Extraction (Firecrawl-compatible):**
```json
{
  "url": "https://www.bog.gov.gh/tender",
  "formats": ["markdown", "extract"],
  "extract": {
    "schema": {
      "type": "object",
      "properties": {
        "tenders": {
          "type": "array",
          "description": "List of tenders found on the page",
          "items": {
            "type": "object",
            "properties": {
              "title": { "type": "string", "description": "Tender title" },
              "deadline": { "type": "string", "description": "Submission deadline" },
              "organization": { "type": "string", "description": "Issuing organization" },
              "reference_number": { "type": "string", "description": "Tender ID/reference" }
            },
            "required": ["title"]
          }
        }
      },
      "required": ["tenders"]
    },
    "systemPrompt": "Extract all tender/procurement opportunities from this page."
  }
}
```

**Response (with extraction):**
```json
{
  "success": true,
  "data": {
    "markdown": "# Page Title\n\nContent...",
    "metadata": {
      "title": "Page Title",
      "description": "Meta description",
      "language": "en",
      "sourceURL": "https://example.com",
      "statusCode": 200
    },
    "links": ["https://example.com/page1"],
    "extract": {
      "tenders": [
        {
          "title": "Supply of IT Equipment",
          "deadline": "2026-03-15",
          "organization": "Bank of Ghana",
          "reference_number": "BOG/ICT/2026/001"
        }
      ]
    }
  }
}
```

### POST /scrape

Native endpoint with same functionality as `/v1/scrape`.

### GET /health

Returns service status and Ollama connectivity.

```json
{
  "status": "ok",
  "service": "stealth-scraper",
  "engine": "camoufox",
  "ollama_url": "http://localhost:11434",
  "ollama_model": "granite4:350m",
  "ollama_status": "connected"
}
```

### Request Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | int | 60000 | Timeout in milliseconds |
| `wait_for_selector` | string | null | CSS selector to wait for |
| `wait_after_load` | int | 2000 | Additional wait after load (ms) |
| `human_scroll` | bool | true | Simulate human scrolling |
| `screenshot` | bool | false | Capture screenshot (base64) |
| `block_media` | bool | true | Block images/videos for speed |

### Output Formats

Include any combination in the `formats` array:

| Format | Description |
|--------|-------------|
| `markdown` | Clean markdown content (default) |
| `html` | Cleaned HTML |
| `rawHtml` | Original HTML |
| `links` | All links on page |
| `screenshot` | Base64 PNG screenshot |
| `extract` | LLM-extracted structured data |

## Testing

### Health Check
```bash
curl http://localhost:3003/health
```

### Basic Scrape
```bash
curl -X POST http://localhost:3003/v1/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.bog.gov.gh", "formats": ["markdown"]}'
```

### Scrape with LLM Extraction
```bash
curl -X POST http://localhost:3003/v1/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.bog.gov.gh/tender",
    "formats": ["markdown", "extract"],
    "extract": {
      "schema": {
        "type": "object",
        "properties": {
          "tenders": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "title": {"type": "string"},
                "deadline": {"type": "string"}
              }
            }
          }
        }
      },
      "systemPrompt": "Extract tender information"
    }
  }'
```

### Test Anti-Bot Bypass
```bash
# Test against known protected sites
curl -X POST http://localhost:3003/v1/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://nowsecure.nl"}'  # Anti-bot test site
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3003 | HTTP server port |
| `HOST` | 0.0.0.0 | HTTP server host |
| `OLLAMA_URL` | http://localhost:11434 | Ollama API endpoint |
| `OLLAMA_MODEL` | granite4:350m | LLM model for extraction |

### Ollama Configuration

For optimal LLM extraction performance, configure Ollama to keep the model warm:

```bash
# Add to /etc/environment (system-wide)
OLLAMA_KEEP_ALIVE=-1

# Or set when starting Ollama
OLLAMA_KEEP_ALIVE=-1 ollama serve
```

This eliminates cold-start latency (~2.75s → ~0.63s per extraction).

## Integration with Frontend

### Automatic Fallback

The frontend's scraper runtime automatically falls back to stealth scraper when Firecrawl is blocked:

**lib/scrapers/runtime.ts:**
```typescript
// Automatically triggered when Firecrawl fails with anti-bot error
if (result.error?.includes("SCRAPE_ALL_ENGINES_FAILED")) {
  return await this.scrapeWithStealth(url, source);
}
```

**lib/scrapers/parsers/llm-extractor.ts:**
```typescript
// LLM extraction also has stealth fallback
const result = await extractTendersWithLLM(url, {
  firecrawl,
  sourceId: "example",
  useStealthFallback: true,  // Enable stealth fallback
  stealthScraperUrl: process.env.STEALTH_SCRAPER_URL
});
```

### Environment Configuration

```bash
# .env.local
STEALTH_SCRAPER_URL=http://localhost:3003        # Local development
STEALTH_SCRAPER_URL=http://YOUR_SERVER:3003      # Production
```

### Direct Usage in TypeScript

```typescript
async function scrapeWithStealth(url: string) {
  const response = await fetch(`${process.env.STEALTH_SCRAPER_URL}/v1/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["markdown", "extract"],
      extract: {
        schema: TENDER_EXTRACTION_SCHEMA,
        systemPrompt: "Extract tender information from this page."
      }
    })
  });

  return response.json();
}
```

## Performance Notes

### Timing Benchmarks

| Operation | Cold Start | Warm |
|-----------|------------|------|
| Browser launch | ~2-3s | N/A |
| Page scrape (with human sim) | ~5-15s | ~5-15s |
| LLM extraction (first) | ~3-5s | ~0.6-1s |
| Total (scrape + extract) | ~10-20s | ~6-16s |

### Resource Usage

| Resource | Usage |
|----------|-------|
| Memory per browser | 200-500MB |
| Memory for Ollama (granite4:350m) | ~400MB |
| CPU during scrape | Moderate (Firefox rendering) |
| CPU during LLM extraction | High (inference) |

### Optimization Tips

1. **Keep Ollama warm**: Set `OLLAMA_KEEP_ALIVE=-1`
2. **Use `block_media: true`**: Faster loads, less memory
3. **Limit concurrency**: 3-5 parallel scrapes max
4. **Use Firecrawl first**: Only fall back to stealth when blocked

### When to Use What

| Site Type | Recommended Tool |
|-----------|------------------|
| Normal sites | Firecrawl (faster, cheaper) |
| Cloudflare protected | Stealth Scraper |
| DataDome protected | Stealth Scraper |
| PerimeterX protected | Stealth Scraper |
| Government portals | Stealth Scraper |
| Heavy JavaScript SPAs | Stealth Scraper |

## Troubleshooting

### "Browser not found"
```bash
python -m camoufox fetch
```

### "Cannot open display"
Ensure `headless=True` is set (default). For headed mode, need X11/VNC.

### "Timeout"
Increase timeout in request options. Some sites are slow.

### "Still getting blocked"
Some sites use additional signals (mouse movement patterns, etc.). Try:
- Adding longer delays
- Disabling `block_media`
- Using a proxy with residential IP

### "Ollama not available" / LLM extraction fails
1. Check Ollama is running: `curl http://localhost:11434/api/tags`
2. Ensure model is pulled: `ollama pull granite4:350m`
3. Check OLLAMA_URL environment variable
4. Review Ollama logs: `journalctl -u ollama` or `snap logs ollama`

### Slow LLM extraction (first request)
Set `OLLAMA_KEEP_ALIVE=-1` to keep model loaded in memory:
```bash
# For snap installation
echo "OLLAMA_KEEP_ALIVE=-1" | sudo tee -a /etc/environment
sudo snap restart ollama

# For systemd installation
sudo systemctl edit ollama --force
# Add: Environment="OLLAMA_KEEP_ALIVE=-1"
sudo systemctl restart ollama
```

### Memory issues
Each browser instance uses 200-500MB. For high concurrency:
- Increase server RAM
- Limit concurrent scrapes
- Use `block_media: true` to reduce memory
