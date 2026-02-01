# DocFusion AI Configuration Guide

This document explains how to configure and troubleshoot the AI features in DocFusion.

## Overview

DocFusion supports multiple AI providers:
- **Azure OpenAI** (Recommended for production)
- **Ollama** (Local AI, for development/privacy)
- **Mock Provider** (Development fallback)

## Environment Variables

### Azure OpenAI Configuration

Add these to your `.env.local` file:

```bash
# Azure OpenAI (Required for production)
AZURE_OPENAI_API_KEY=your_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
AZURE_OPENAI_API_VERSION=2024-02-15-preview  # Optional, defaults to this
```

**Where to get these values:**
1. **AZURE_OPENAI_API_KEY**: From your Azure Portal > Azure OpenAI > Keys and Endpoint
2. **AZURE_OPENAI_ENDPOINT**: Your Azure OpenAI resource endpoint URL
3. **AZURE_OPENAI_DEPLOYMENT_NAME**: The name of your deployed model (e.g., "gpt-4o")

### Ollama Configuration (Optional)

```bash
# Ollama (For local AI development)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=llama3.2
OLLAMA_CORS=true  # Enable CORS for local development
```

## Configuration Status

### Check Your Configuration

Visit the Settings page and look for the "AI Configuration Status" card, or call:

```
GET /api/v1/ai/models
```

This returns:
```json
{
  "available": true,
  "activeProvider": "azure-openai",
  "envVars": {
    "AZURE_OPENAI_API_KEY": true,
    "AZURE_OPENAI_ENDPOINT": true,
    "AZURE_OPENAI_DEPLOYMENT_NAME": true,
    "AZURE_OPENAI_API_VERSION": true
  },
  "providers": [
    {
      "provider": "azure-openai",
      "configured": true,
      "available": true,
      "message": "Azure OpenAI is configured and available"
    },
    {
      "provider": "ollama",
      "configured": false,
      "available": false,
      "message": "Ollama is not responding..."
    }
  ],
  "models": [...]
}
```

## Troubleshooting

### "Create Document" Does Nothing

**Symptoms:** Clicking "Create Document" in the blank document dialog doesn't work.

**Check:**
1. Check browser console for errors
2. Verify environment variables are set:
   ```bash
   cat .env.local | grep AZURE
   ```
3. Restart the dev server after changing `.env.local`
4. Check network tab for API errors

### "No AI Provider Available" Error

**Symptoms:** AI features return 503 errors.

**Solutions:**

1. **Set Azure OpenAI credentials** (Production)
   ```bash
   AZURE_OPENAI_API_KEY=...
   AZURE_OPENAI_ENDPOINT=https://...azure.com/
   AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
   ```

2. **Enable Mock Provider** (Development only)
   
   The mock provider automatically activates when:
   - `NODE_ENV !== "production"`
   - No real provider is configured
   
   The mock returns simulated responses for development/testing.

3. **Start Ollama** (Local development)
   ```bash
   ollama serve
   ollama pull llama3.2
   ```

### Environment Variables Not Loading

**Check:**
1. File is named `.env.local` (not `.env`)
2. File is in `frontend/` directory
3. Restart the Next.js server
4. No syntax errors in `.env.local`

### Azure OpenAI Connection Fails

**Check:**
1. API key is valid (not expired)
2. Endpoint URL is correct
3. Deployment name matches your Azure deployment
4. Your Azure subscription has quota available

## Development Mode

When `NODE_ENV !== "production"` and no provider is configured:
- Mock provider automatically activates
- AI features return simulated responses
- Document creation works without AI

To force use of real AI in development, set all Azure env vars.

## Files Changed for This Fix

- `lib/ai/providers/mock.ts` - New mock provider
- `lib/ai/providers/factory.ts` - Added mock fallback
- `app/api/v1/ai/models/route.ts` - Enhanced status endpoint
- `app/api/v1/ai/completion/route.ts` - Better error messages
- `app/(app)/documents/page.tsx` - Added feedback/loading states
- `components/settings/ai-config-check.tsx` - Configuration UI
- `AI_CONFIG.md` - This documentation
