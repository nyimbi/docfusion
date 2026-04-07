# Firecrawl + Ollama Integration Guide

Configure self-hosted Firecrawl to use local Ollama for LLM-based extraction instead of OpenAI API.

## Prerequisites

- Self-hosted Firecrawl instance
- Ollama installed (via snap or native)
- A small, fast model suitable for your hardware

## 1. Install Ollama Model

Choose a model based on your hardware:

| Hardware | Recommended Model | Size | Notes |
|----------|------------------|------|-------|
| CPU only (4 cores) | `granite4:350m` | 350M params | ~0.6s response |
| CPU only (8+ cores) | `ministral-3:3b` | 3.8B params | ~60-120s response |
| GPU (8GB+ VRAM) | `llama3.1:8b` | 8B params | Fast with GPU |

```bash
# Pull your chosen model
ollama pull granite4:350m
```

## 2. Configure Ollama Keep-Alive

Prevent model unloading between requests:

### For snap installation:
```bash
echo 'OLLAMA_KEEP_ALIVE=-1' | sudo tee -a /etc/environment
sudo snap restart ollama
```

### For native/systemd installation:
```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/environment.conf << 'EOF'
[Service]
Environment="OLLAMA_KEEP_ALIVE=-1"
EOF
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

### Warm up the model:
```bash
curl http://localhost:11434/api/generate -d '{"model":"granite4:350m","prompt":"hello","stream":false}'
```

## 3. Configure Firecrawl

Edit `~/firecrawl/apps/api/.env`:

```bash
# Ollama via OpenAI-compatible API
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama
MODEL_NAME=granite4:350m
```

**Key points:**
- Use `/v1` endpoint (OpenAI-compatible), not `/api` (native Ollama)
- `OPENAI_API_KEY` can be any non-empty string (Ollama doesn't validate it)
- `MODEL_NAME` must match the model you pulled

## 4. Patch Firecrawl LLM Extract (Required for v1.x)

Firecrawl's `llmExtract.ts` hardcodes `"openai"` as the provider, bypassing dynamic selection. Fix this:

```bash
cd ~/firecrawl/apps/api

# Patch the source to remove hardcoded "openai" provider
sed -i 's/getModel(\([^,)]*\), "openai")/getModel(\1)/g' src/scraper/scrapeURL/transformers/llmExtract.ts

# Rebuild
pnpm run build

# Restart Firecrawl
pm2 restart firecrawl
```

### What this fixes:

**Before (broken):**
```typescript
const model = getModel("gpt-4o-mini", "openai");  // Always uses OpenAI
```

**After (working):**
```typescript
const model = getModel("gpt-4o-mini");  // Uses MODEL_NAME from env
```

## 5. Verify Setup

Test the API directly:

```bash
curl -X POST http://localhost:3002/v1/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer api-key" \
  -d '{
    "url": "https://www.comesa.int/tenders/",
    "formats": ["extract"],
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
                "organization": {"type": "string"},
                "deadline": {"type": "string"}
              },
              "required": ["title"]
            }
          }
        }
      }
    }
  }'
```

## 6. Client Code Example

```typescript
import { FirecrawlClient } from "./lib/scrapers/firecrawl";

const firecrawl = new FirecrawlClient({
  baseUrl: "http://your-server:3002",
  apiKey: "api-key",
});

const result = await firecrawl.scrape("https://example.com/tenders", {
  formats: ["extract"],
  timeout: 300000, // 5 min for CPU inference
  extract: {
    schema: {
      type: "object",
      properties: {
        tenders: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              organization: { type: "string" },
              deadline: { type: "string" },
            },
            required: ["title"],
          },
        },
      },
    },
    systemPrompt: "Extract all tender/procurement opportunities from this page.",
  },
});

console.log(result.data?.extract);
```

## Troubleshooting

### Error: "OpenAI API key is missing"
- The `llmExtract.ts` patch wasn't applied correctly
- Run the sed command and rebuild

### Error: "AI SDK 5 only supports models that implement specification version v2"
- You're using the native Ollama provider instead of OpenAI-compatible mode
- Change `OPENAI_BASE_URL` to use `/v1` endpoint

### Timeouts with thinking models (qwen3, lfm2.5-thinking)
- Thinking models perform extended reasoning, taking minutes per request
- Use non-thinking models: `granite4:350m`, `ministral-3:3b`, `llama3.1`

### Model unloads between requests (slow first request)
- `OLLAMA_KEEP_ALIVE` not set or Ollama not restarted
- Verify with: `cat /etc/environment | grep OLLAMA`

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Your App      │────▶│    Firecrawl     │────▶│     Ollama      │
│                 │     │   (port 3002)    │     │  (port 11434)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                        │
                               │ OPENAI_BASE_URL        │ /v1/chat/completions
                               │ = localhost:11434/v1   │ (OpenAI-compatible)
                               │                        │
                               │ MODEL_NAME             │ granite4:350m
                               │ = granite4:350m        │ (loaded in memory)
                               └────────────────────────┘
```

## Cost Comparison

| Provider | Model | Cost per 1M tokens |
|----------|-------|-------------------|
| OpenAI | gpt-4o-mini | $0.15 input / $0.60 output |
| Ollama (self-hosted) | granite4:350m | $0 (compute only) |

For 2000+ tender sources scraped daily, self-hosted Ollama provides significant cost savings.
