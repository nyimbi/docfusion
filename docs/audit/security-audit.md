# Security Audit Report - DocuFusion

**Date:** 2026-04-06  
**Auditor:** Security Reviewer Agent  
**Scope:** Full codebase security audit - secrets management, input validation, authentication/authorization, API security, data exposure, dependency security  
**Risk Level:** HIGH

---

## Executive Summary

This security audit identified **2 CRITICAL**, **4 HIGH**, **6 MEDIUM**, and **3 LOW** severity issues. The most critical finding is hardcoded production secrets committed to the repository, which requires **immediate remediation**.

### Summary Statistics

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 2 | Requires immediate action |
| High | 4 | Fix within sprint |
| Medium | 6 | Fix within month |
| Low | 3 | Backlog |

---

## Critical Issues (Fix Immediately)

### 1. Hardcoded Production Secrets in Repository

**Severity:** CRITICAL  
**Category:** A02:2021 - Cryptographic Failures  
**Location:** Multiple environment files  
**Exploitability:** Remote, unauthenticated  
**Blast Radius:** Full database access, Azure OpenAI API access, email system compromise, LLM gateway access

**Issue:** Production secrets are hardcoded in tracked `.env` files that should not be in version control:

| File | Exposed Secrets |
|------|-----------------|
| `frontend/.env.local` | `AZURE_OPENAI_API_KEY`, `DATABASE_URL`, `SMTP_PASS`, `LITELLM_KEY`, `PUSHER_APP_SECRET` |
| `frontend/.env` | legacy auth secret, `AZURE_OPENAI_API_KEY`, `DATABASE_URL`, `PUSHER_APP_SECRET` |
| `.env` (root) | `AZURE_OPENAI_API_KEY`, `DATABASE_URL`, `SECRET_KEY` |

**Specific Leaked Credentials (redacted):**

```
AZURE_OPENAI_API_KEY=<redacted>
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
AUTH_SECRET=<redacted>
SMTP_PASS=<redacted>
LITELLM_KEY=<redacted>
```

**Remediation:**

```bash
# 1. IMMEDIATE: Rotate ALL exposed credentials
# - Azure OpenAI: Regenerate API key in Azure portal
# - PostgreSQL: Change database passwords
# - SMTP: Change email credentials
# - Better Auth: Generate new secret
# - LiteLLM: Regenerate master key

# 2. Add to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo "*.env.local" >> .gitignore
echo "frontend/.env" >> .gitignore
echo "frontend/.env.local" >> .gitignore

# 3. Remove from git history (CRITICAL)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env frontend/.env frontend/.env.local" \
  --prune-empty --tag-name-filter cat -- --all

# 4. Force push (requires team coordination)
git push origin --force --all

# 5. Use environment variables or secret management
# Production: Use Azure Key Vault, AWS Secrets Manager, or HashiCorp Vault
# Development: Use .env files that are in .gitignore
```

---

### 2. Hardcoded Database Credentials in Configuration File

**Severity:** CRITICAL  
**Category:** A02:2021 - Cryptographic Failures  
**Location:** `alembic.ini:44`  
**Exploitability:** Local access to repo = database access  
**Blast Radius:** Full database compromise

**Issue:**

```ini
sqlalchemy.url = postgresql://<user>:<password>@<host>:5432/<database>
```

**Remediation:**

```python
# alembic.ini - Remove hardcoded credentials
# Use environment variable substitution:
sqlalchemy.url = postgresql://%(DB_USER)s:%(DB_PASS)s@%(DB_HOST)s:%(DB_PORT)s/%(DB_NAME)s

# Or use alembic/env.py to read from environment:
# config.set_main_option("sqlalchemy.url", os.environ.get("DATABASE_URL"))
```

---

## High Issues (Fix Within Sprint)

### 3. Missing API Rate Limiting

**Severity:** HIGH  
**Category:** A07:2021 - Identification and Authentication Failures  
**Location:** All API routes in `frontend/app/api/`  
**Exploitability:** Remote, unauthenticated  
**Blast Radius:** DoS, resource exhaustion, credential stuffing

**Issue:** No rate limiting middleware detected on API endpoints. While individual notification channels have rate limiting, the core API endpoints lack protection.

**Files reviewed:**
- `frontend/app/api/v1/import/execute/route.ts`
- `frontend/app/api/v1/import/parse/route.ts`
- `frontend/app/api/v1/rfp/upload/route.ts`
- `frontend/app/api/v1/ai/completion/route.ts`
- All other API routes

**Remediation:**

```typescript
// middleware.ts or rate-limit.ts
import { NextRequest, NextResponse } from 'next/server';

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100; // requests per window

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const key = `rate-limit:${ip}`;
    const now = Date.now();
    
    const record = rateLimitStore.get(key);
    if (record && record.resetTime > now && record.count >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: 'Too many requests, please try again later.' },
        { status: 429 }
      );
    }
    
    // Update rate limit
    rateLimitStore.set(key, {
      count: (record?.count ?? 0) + 1,
      resetTime: record?.resetTime ?? now + RATE_LIMIT_WINDOW,
    });
  }
  return NextResponse.next();
}
```

---

### 4. npm Dependency Vulnerabilities (226 Total)

**Severity:** HIGH  
**Category:** A06:2021 - Vulnerable and Outdated Components  
**Location:** `frontend/package.json`  
**Exploitability:** Varies by vulnerability  
**Blast Radius:** XSS, DoS, prototype pollution

**Issue:** npm audit reveals 226 vulnerabilities including:

| Package | Severity | Vulnerability |
|---------|----------|---------------|
| `@babel/runtime` | Moderate | Inefficient RegExp complexity (GHSA-968p-4wvh-cqc8) |
| `@braintree/sanitize-url` | Moderate | XSS vulnerability (GHSA-hqq7-2q2v-82xq) |
| `@chevrotain/cst-dts-gen` | Moderate | Prototype pollution via lodash-es |
| Multiple others | Various | See full npm audit output |

**Remediation:**

```bash
# Review all vulnerabilities
cd frontend && npm audit

# Fix automatically where possible
npm audit fix

# For vulnerabilities requiring manual review:
npm audit fix --force  # Use with caution

# Update specific packages
npm update @babel/runtime @braintree/sanitize-url

# Consider using npm audit in CI pipeline
```

---

### 5. XSS Risk via dangerouslySetInnerHTML

**Severity:** HIGH  
**Category:** A03:2021 - Injection  
**Location:** Multiple frontend components  
**Exploitability:** Remote, authenticated  
**Blast Radius:** Session hijacking, data theft, CSRF

**Issue:** Multiple components use `dangerouslySetInnerHTML` with SVG content:

| File | Line | Pattern |
|------|------|---------|
| `frontend/components/document/PlantUMLEditor.tsx` | 335 | `dangerouslySetInnerHTML={{ __html: sanitizeHTML(svg) }}` |
| `frontend/components/document/DiagramEditor.tsx` | 417 | `dangerouslySetInnerHTML={{ __html: sanitizeHTML(svgContent) }}` |
| `frontend/components/document/DiagramPanel.tsx` | 417 | `dangerouslySetInnerHTML={{ __html: sanitizeHTML(renderedSvg) }}` |
| `frontend/components/document/D2Editor.tsx` | 267 | `dangerouslySetInnerHTML={{ __html: sanitizeHTML(svg) }}` |
| `frontend/components/document/StructurizrEditor.tsx` | 303 | `dangerouslySetInnerHTML={{ __html: sanitizeHTML(svg) }}` |
| `frontend/components/document/DiagramPreview.tsx` | 321 | `dangerouslySetInnerHTML={{ __html: sanitizeHTML(svg) }}` |
| `frontend/components/document/DiagramInsertDialog.tsx` | 456 | `dangerouslySetInnerHTML={{ __html: sanitizeHTML(state.preview ?? "") }}` |
| `frontend/components/reviews/ReviewInterface.tsx` | 288 | `dangerouslySetInnerHTML={{ __html: sanitizeHTML(currentSection.content) }}` |
| `frontend/components/graphics/GraphicPreview.tsx` | 294 | `containerRef.current.innerHTML = sanitizedSvg` |

**Positive Note:** The code uses `sanitizeHTML` function (DOMPurify-based), which mitigates the risk.

**Remediation:**

```typescript
// Verify sanitizeHTML implementation uses DOMPurify with strict config
import DOMPurify from 'dompurify';

// Configure DOMPurify for SVG
const sanitizeHTML = (html: string): string => {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  });
};

// Consider CSP headers as additional protection
// next.config.ts
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
};
```

---

### 6. Insecure Session Storage

**Severity:** HIGH  
**Category:** A07:2021 - Identification and Authentication Failures  
**Location:** `src/docfusion/api/middleware/authentication_middleware.py:56-57`  
**Exploitability:** Server access required  
**Blast Radius:** Session hijacking for all users on same server

**Issue:**

```python
# Session storage (in production, use Redis or database)
self.active_sessions: Dict[str, Dict[str, Any]] = {}
```

In-memory session storage is not suitable for production:
- Sessions lost on server restart
- Not scalable across multiple servers
- No persistence for audit trails

**Remediation:**

```python
# Use Redis for session storage
import aioredis

class AuthenticationMiddleware:
    def __init__(self, security_manager: SecurityManager):
        self.redis = aioredis.from_url(
            os.environ.get("REDIS_URL", "redis://localhost:6379"),
            encoding="utf-8",
            decode_responses=True
        )
    
    async def create_session(self, user_id: str, ...) -> Dict[str, Any]:
        session_id = uuid7str()
        session_data = {
            "user_id": user_id,
            "authenticated_at": datetime.utcnow().isoformat(),
            # ...
        }
        await self.redis.setex(
            f"session:{session_id}",
            self.jwt_expiration_minutes * 60,
            json.dumps(session_data)
        )
        return session_data
```

---

## Medium Issues (Fix Within Month)

### 7. SSRF Potential in External Service Calls

**Severity:** MEDIUM  
**Category:** A10:2021 - Server-Side Request Forgery  
**Location:** Multiple scraper and API files  
**Exploitability:** Remote, authenticated  
**Blast Radius:** Internal network access, cloud metadata

**Issue:** Multiple components make HTTP requests to external URLs without strict allowlisting:

| File | Risk |
|------|------|
| `src/docfusion/infrastructure/firecrawl_client.py` | Fetches URLs from user input |
| `src/docfusion/discovery/crawlers/` | Scrapes arbitrary URLs |
| `frontend/lib/scrapers/fetcher.ts` | Fetches URLs from scraper sources |

**Remediation:**

```python
# Implement URL allowlisting
import socket
import ipaddress
from urllib.parse import urlparse

ALLOWED_DOMAINS = [
    "sam.gov",
    "grants.gov",
    "worldbank.org",
    # ... legitimate RFP sources
]

def validate_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in ['http', 'https']:
        return False
    if parsed.netloc.lower() not in ALLOWED_DOMAINS:
        # Block internal IP ranges
        try:
            ip = socket.gethostbyname(parsed.netloc)
            if ipaddress.ip_address(ip).is_private:
                return False
        except:
            return False
    return True
```

---

### 8. File Upload Missing Content Validation

**Severity:** MEDIUM  
**Category:** A03:2021 - Injection  
**Location:** `frontend/app/api/v1/rfp/upload/route.ts:45-90`  
**Exploitability:** Remote, authenticated  
**Blast Radius:** Malicious file upload, storage abuse

**Issue:** File upload validates extension and size but does not validate file content:

```typescript
// Current validation
const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
if (!ALLOWED_EXTENSIONS.has(extension)) { ... }
if (file.size > MAX_FILE_SIZE) { ... }

// Missing:
// - Magic byte validation
// - Content type verification
// - Malware scanning
// - Filename sanitization
```

**Remediation:**

```typescript
import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // ...
]);

// Add content validation
const buffer = Buffer.from(await file.arrayBuffer());
const detectedType = await fileTypeFromBuffer(buffer);

if (!detectedType || !ALLOWED_MIME_TYPES.has(detectedType.mime)) {
  return NextResponse.json(
    { error: 'Invalid file content type' },
    { status: 400 }
  );
}

// Sanitize filename
const sanitizedName = file.name
  .replace(/[^a-zA-Z0-9._-]/g, '_')
  .replace(/\.{2,}/g, '.');

// Consider virus scanning
// await scanForMalware(buffer);
```

---

### 9. CORS Configuration Too Permissive for Development

**Severity:** MEDIUM  
**Category:** A05:2021 - Security Misconfiguration  
**Location:** `src/docfusion/api/app.py:34-36`, `src/docfusion/api/main.py:50`  
**Exploitability:** Remote, browser-based  
**Blast Radius:** CSRF, data theft

**Issue:** CORS defaults to localhost:3000 which could be exploitable in development:

```python
cors_allowed_origins: str = "http://localhost:3000"
origins_env = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
```

**Remediation:**

```python
# Use strict CORS in production
import os

def get_cors_origins() -> list[str]:
    origins_env = os.environ.get("CORS_ALLOWED_ORIGINS", "")
    if not origins_env:
        if os.environ.get("ENVIRONMENT") == "production":
            raise RuntimeError("CORS_ALLOWED_ORIGINS must be set in production")
        return ["http://localhost:3000"]  # Development only
    
    return [origin.strip() for origin in origins_env.split(",")]

# Add CORS security headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
    max_age=3600,  # Cache preflight for 1 hour
)
```

---

### 10. Sensitive Data in Logs

**Severity:** MEDIUM  
**Category:** A09:2021 - Security Logging and Monitoring Failures  
**Location:** Multiple notification channel files  
**Exploitability:** Server access required  
**Blast Radius:** Credential exposure, compliance violation

**Issue:** Debug logging may expose sensitive data:

| File | Line | Issue |
|------|------|-------|
| `src/docfusion/notifications/channels/telegram_channel.py` | 358 | `self.logger.debug("Payload: %s", json.dumps(payload, indent=2))` |
| `src/docfusion/notifications/channels/whatsapp_channel.py` | 349 | `self.logger.debug("Payload: %s", json.dumps(payload, indent=2))` |

**Remediation:**

```python
# Remove sensitive fields from logging
SENSITIVE_FIELDS = ['token', 'password', 'secret', 'api_key', 'auth', 'credential']

def sanitize_for_logging(data: dict) -> dict:
    """Remove sensitive fields from data before logging."""
    result = {}
    for key, value in data.items():
        if any(sensitive in key.lower() for sensitive in SENSITIVE_FIELDS):
            result[key] = '[REDACTED]'
        elif isinstance(value, dict):
            result[key] = sanitize_for_logging(value)
        else:
            result[key] = value
    return result

# Use in logging
self.logger.debug("Payload: %s", json.dumps(sanitize_for_logging(payload), indent=2))
```

---

### 11. Missing Content-Security-Policy Headers

**Severity:** MEDIUM  
**Category:** A05:2021 - Security Misconfiguration  
**Location:** `frontend/next.config.ts`  
**Exploitability:** Remote, browser-based  
**Blast Radius:** XSS, clickjacking, data injection

**Issue:** No CSP headers configured in Next.js config.

**Remediation:**

```typescript
// next.config.ts
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.lindela.io",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join('; '),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

---

### 12. Google OAuth Tokens Stored in Cookies

**Severity:** MEDIUM  
**Category:** A02:2021 - Cryptographic Failures  
**Location:** `frontend/app/api/v1/google/callback/route.ts:100-109`  
**Exploitability:** XSS, browser access  
**Blast Radius:** Google account access

**Issue:** OAuth tokens stored in cookies without encryption:

```typescript
response.cookies.set("google_access_token", tokens.access_token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 60 * 60, // 1 hour
});
```

**Remediation:**

```typescript
// Encrypt tokens before storing in cookies
import { encrypt, decrypt } from '@/lib/crypto';

// Store encrypted token
const encryptedToken = encrypt(tokens.access_token, process.env.ENCRYPTION_KEY);
response.cookies.set("google_access_token", encryptedToken, {
  httpOnly: true,
  secure: true, // Always true in production
  sameSite: "strict",
  maxAge: 60 * 60,
  path: "/",
});

// Decrypt when reading
const encryptedToken = request.cookies.get("google_access_token")?.value;
const accessToken = decrypt(encryptedToken, process.env.ENCRYPTION_KEY);
```

---

## Low Issues (Fix Eventually)

### 13. Debug Mode Enabled in Environment

**Severity:** LOW  
**Category:** A05:2021 - Security Misconfiguration  
**Location:** `frontend/.env.local:22`, `frontend/.env:22`  
**Exploitability:** Requires server access  
**Blast Radius:** Verbose error messages, stack traces

**Issue:**

```
NEXT_PUBLIC_DEBUG=true
```

**Remediation:**

```bash
# Remove from environment files, use only in development
# Never commit DEBUG=true to production configs
DEBUG=false  # Production default
```

---

### 14. Test Files Contain Placeholder Credentials

**Severity:** LOW  
**Category:** A02:2021 - Cryptographic Failures  
**Location:** Multiple test files  
**Exploitability:** N/A (test files)  
**Blast Radius:** None (if not used in production)

**Issue:**

```python
# tests/performance/api_performance_tests.py:519
auth_token="sample_token_here"  # Replace with actual token

# src/docfusion/api/app.py:94
app = create_app(settings=ServiceSettings(jwt_secret="test-secret"))
```

**Remediation:**

```python
# Use environment variables or fixtures in tests
import os
import pytest

@pytest.fixture
def test_jwt_secret():
    return os.environ.get("TEST_JWT_SECRET", "test-secret-for-testing-only")

# Ensure production code never uses test secrets
if os.environ.get("ENVIRONMENT") == "production":
    assert "test-secret" not in jwt_secret, "Production must not use test secrets"
```

---

### 15. Documentation Contains Example Secrets

**Severity:** LOW  
**Category:** A02:2021 - Cryptographic Failures  
**Location:** Multiple documentation files  
**Exploitability:** N/A (documentation)  
**Blast Radius:** Developers might copy-paste

**Issue:**

```markdown
# docs/rag_performance_testing.md:87
export OPENAI_API_KEY="your-key-here"

# docs/ollama_integration.md:340
openai_api_key="sk-...",

# deployment/README.md:65
export DB_PASSWORD="your-secure-password"
```

**Remediation:**

```markdown
# Use placeholder patterns that are clearly not real
export OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxxxxxx"

# Add warnings
# ⚠️ NEVER commit real API keys. Use environment variables.
```

---

## Security Checklist

- [x] **Secrets Management** - Hardcoded secrets found (CRITICAL)
- [x] **Input Validation** - File upload needs content validation
- [x] **Injection Prevention** - XSS via dangerouslySetInnerHTML mitigated with sanitization
- [x] **Authentication/Authorization** - JWT validation present, session storage needs improvement
- [x] **Dependency Audit** - 226 npm vulnerabilities found
- [ ] **Rate Limiting** - Not implemented on API routes
- [ ] **CSP Headers** - Not configured
- [ ] **Content Validation** - File uploads lack content verification
- [ ] **SSRF Prevention** - URL validation needed for external requests
- [ ] **Logging Sanitization** - Sensitive data may be logged

---

## Remediation Priority

| Priority | Issue | Timeline |
|----------|-------|----------|
| 1 | Rotate exposed secrets (CRITICAL) | Immediate (within 1 hour) |
| 2 | Remove secrets from git history | Immediate (within 4 hours) |
| 3 | Implement rate limiting | Within 1 sprint |
| 4 | Fix npm vulnerabilities | Within 1 week |
| 5 | Add CSP headers | Within 2 weeks |
| 6 | Implement Redis session storage | Within 1 month |
| 7 | Add file content validation | Within 1 month |
| 8 | Encrypt OAuth tokens in cookies | Within 1 month |
| 9 | Implement SSRF URL validation | Within 1 month |
| 10 | Sanitize log outputs | Backlog |

---

## Recommendations

### Immediate Actions (Today)

1. **Rotate ALL exposed credentials immediately:**
   - Azure OpenAI API key
   - PostgreSQL passwords (both databases)
   - SMTP credentials
   - Better Auth secret
   - LiteLLM master key
   - Pusher app secret

2. **Remove secrets from version control:**
   - Add `.env*` patterns to `.gitignore`
   - Use `git filter-branch` or BFG Repo-Cleaner to purge history
   - Force push after team coordination

3. **Implement secret management:**
   - Use Azure Key Vault, AWS Secrets Manager, or HashiCorp Vault
   - Never commit secrets to git

### Short-Term Actions (This Sprint)

1. Add rate limiting middleware to all API routes
2. Run `npm audit fix` to address dependency vulnerabilities
3. Configure CSP and security headers in Next.js
4. Review and update CORS configuration

### Medium-Term Actions (This Month)

1. Migrate session storage to Redis
2. Add file content validation (magic bytes, MIME type verification)
3. Implement URL allowlisting for external service calls
4. Add logging sanitization for sensitive data
5. Encrypt OAuth tokens before cookie storage

### Long-Term Actions

1. Implement automated secret scanning in CI/CD (e.g., git-secrets, detect-secrets)
2. Add SAST/DAST scanning to pipeline
3. Regular security audits (quarterly)
4. Security awareness training for developers

---

## Files Reviewed

| Category | Files |
|----------|-------|
| Environment Files | `.env`, `frontend/.env`, `frontend/.env.local`, `config/prod/.env.example`, `config/local/.env.example` |
| API Routes | `frontend/app/api/v1/**/*.ts`, `frontend/app/api/scrapers/**/*.ts` |
| Authentication | `src/docfusion/api/middleware/authentication_middleware.py`, `frontend/middleware.ts` |
| Configuration | `alembic.ini`, `src/docfusion/api/dependencies.py`, `src/docfusion/api/main.py` |
| File Uploads | `frontend/app/api/v1/rfp/upload/route.ts`, `frontend/app/api/v1/import/parse/route.ts` |
| OAuth | `frontend/app/api/v1/google/auth/route.ts`, `frontend/app/api/v1/google/callback/route.ts` |
| Notification Channels | `src/docfusion/notifications/channels/*.py` |

---

## Appendix: Detection Methods

- **Grep patterns used:**
  - `api[_-]?key|password|secret|token|credential|auth`
  - `dangerouslySetInnerHTML|innerHTML`
  - `execute|exec|system|shell|popen|subprocess\.call`
  - `session|cookie|jwt|bearer|auth`
  - `fetch\(|axios|request\(`

- **Tools used:**
  - npm audit (dependency vulnerabilities)
  - Manual code review

- **Git history analysis:**
  - Checked for secrets in committed files

---

**Report Generated:** 2026-04-06  
**Next Review Due:** 2026-07-06
