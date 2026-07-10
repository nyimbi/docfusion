# DocuFusion Production Readiness Design

**Date**: 2026-03-01
**Status**: Approved
**Timeline**: 5-6 weeks
**Priority**: Fresh tender data first

## Executive Summary

This design outlines the plan to bring DocuFusion to production readiness over 5-6 weeks, following a Foundation-First approach that prioritizes data freshness, testing, and deployment infrastructure before adding features.

## Requirements Summary

| Category | Choice |
|----------|--------|
| **Deployment** | Self-hosted VPS (Azure VM 20.84.71.33) |
| **Timeline** | 5-6 weeks |
| **Priority** | Fresh tender data |
| **Auth** | Single org + local auth (Better Auth) |
| **Coverage** | ~70% standard |
| **Database** | PostgreSQL on Azure VM |
| **Files** | Local filesystem |
| **E-signature** | PAdES/digital signatures |
| **Email** | Self-hosted Postfix |
| **Extra Features** | Web push, Analytics |

## Architecture Overview

### Server Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Azure VM (20.84.71.33)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   nginx     │  │   PM2       │  │  PostgreSQL │              │
│  │   :443      │  │   manager   │  │   :5432      │              │
│  │   :80       │  │             │  │              │              │
│  └──────┬──────┘  └──────┬──────┘  └──────────────┘              │
│         │                │                                        │
│         │         ┌──────┴──────┐                                 │
│         │         │             │                                 │
│         ▼         ▼             ▼                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Next.js app │  │ Firecrawl   │  │ Docling     │              │
│  │ :3000       │  │ :3002       │  │ :3600       │              │
│  └─────────────┘  ├─────────────┤  ├─────────────┤              │
│                   │ Stealth     │  │ Ollama      │              │
│                   │ :3003       │  │ :11434      │              │
│                   ├─────────────┤  └─────────────┘              │
│                   │ SearXNG     │                               │
│                   │ :3500       │                               │
│                   └─────────────┘                               │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Postfix     │  │ PostgreSQL  │  │ Backups     │              │
│  │ :25         │  │ backups     │  │ (daily)     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Freshness Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                     SCRAPER SCHEDULING LAYER                      │
├─────────────────────────────────────────────────────────────────┤
│  systemd timers (or cron)                                        │
│  ├── tier1.timer  → tier1.service  (every 6h)                   │
│  ├── tier2.timer  → tier2.service  (every 12h)                  │
│  └── tier3.timer  → tier3.service  (daily 06:00 UTC)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SCRAPER RUNTIME                              │
├─────────────────────────────────────────────────────────────────┤
│  frontend/lib/scrapers/runtime.ts                                │
│  ├── Firecrawl client (port 3002)                                │
│  ├── Stealth scraper fallback (port 3003)                        │
│  ├── Rate limiting per source                                    │
│  └── Progress callbacks for UI                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATA LAYER                                    │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL (opportunities, scraper_runs, scraper_sources)        │
│  ├── Deduplication by fingerprint                                 │
│  ├── Health tracking per source                                   │
│  └── Upsert logic                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MONITORING                                    │
├─────────────────────────────────────────────────────────────────┤
│  scraper_runs table (success_rate, last_run_at, errors)           │
│  + Email alerts on consecutive failures                           │
│  + Dashboard widget in UI                                         │
└─────────────────────────────────────────────────────────────────┘
```

## Weekly Breakdown

### Week 1: Data Pipeline

**Goal**: Fresh tender data flowing from all 25 sources

**Deliverables**:
- systemd timer/service files for each tier
- Scraper runner script with proper error handling
- Health monitoring in database
- Email alerts for failures
- Dashboard widget showing scraper status

**Files to create/modify**:
```
backend/discovery/scheduler/
├── tier1.timer
├── tier1.service
├── tier2.timer
├── tier2.service
├── tier3.timer
├── tier3.service
└── scraper_runner.py

frontend/lib/actions/
└── scraper-runs.ts

frontend/app/api/cron/scrape/
└── route.ts

frontend/components/dashboard/
└── ScraperStatusWidget.tsx
```

### Week 2: Testing

**Goal**: 70% test coverage across backend and frontend

**Test Pyramid**:
```
                      ▲ E2E Tests (Playwright)
                     ▲▲ Critical user flows (~10 tests)
                    ▲▲▲
                   ▲▲▲▲ Integration Tests (Vitest)
                  ▲▲▲▲▲ API routes, DB interactions (~50 tests)
                 ▲▲▲▲▲▲
                ▲▲▲▲▲▲▲ Unit Tests (Vitest)
               ▲▲▲▲▲▲▲▲ Utilities, scrapers, parsers (~100 tests)
```

**Backend Test Structure**:
```
tests/ci/
├── conftest.py              # Fixtures, DB setup
├── test_scrapers/
│   ├── test_afdb.py
│   ├── test_ungm.py
│   └── test_dedup.py
├── test_pipeline/
│   ├── test_transformer.py
│   ├── test_categorizer.py
│   └── test_sync.py
└── test_models/
    └── test_opportunity.py
```

**Frontend Test Structure**:
```
frontend/__tests__/
├── setup.ts
├── unit/
│   ├── scrapers/
│   │   ├── runtime.test.ts
│   │   ├── deduplicator.test.ts
│   │   └── parsers.test.ts
│   └── lib/
│       └── utils.test.ts
├── integration/
│   ├── opportunities.test.ts
│   ├── documents.test.ts
│   └── scrapers.test.ts
└── e2e/
    └── opportunity-flow.spec.ts
```

### Week 3: Deployment

**Goal**: Production deployment with SSL, backups, and CI/CD

**Nginx Configuration**:
```nginx
server {
    listen 443 ssl http2;
    server_name docfusion.com www.docfusion.com;

    ssl_certificate /etc/letsencrypt/live/docfusion/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/docfusion/privkey.pem;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

**PM2 Ecosystem**:
```javascript
module.exports = {
  apps: [
    {
      name: 'docfusion-frontend',
      // Retired Azure server note (2026-06-16): previous Azure app-server path was removed.
      script: 'npm',
      args: 'start',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'scraper-tier1',
      // Retired Azure server note (2026-06-16): previous Azure app-server path was removed.
      script: 'scraper_runner.py',
      args: '--tier 1',
      cron_restart: '0 */6 * * *',
      watch: false
    }
  ]
};
```

**Backup Script**:
```bash
#!/bin/bash
# Retired Azure server note (2026-06-16): previous Azure app-server backup path was removed.
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
pg_dump docfusion > $BACKUP_DIR/db_$DATE.sql

# File backup
# Retired Azure server note (2026-06-16): previous Azure app-server upload path was removed.

# Keep last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete
```

### Week 4: Notifications

**Goal**: Email alerts and web push notifications

**Email Architecture**:
```
Application Event
       │
       ▼
┌─────────────┐
│ Email Queue │  (PostgreSQL table: email_queue)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Postfix     │  (Local MTA, port 25)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Recipient   │  (External email address)
└─────────────┘
```

**Database Schema**:
```sql
CREATE TABLE email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INT DEFAULT 0
);

CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Email Templates**:
- Scraper failure alerts
- Deadline reminders (1 week, 3 days, 1 day)
- New opportunity matches
- Document analysis complete

### Week 5: E-Signature

**Goal**: PAdES digital signature implementation

**Architecture**:
```
1. Document Preparation
   ├── Generate PDF from LaTeX/DOCX
   └── Add signature fields (visual placeholders)

2. Certificate Management
   ├── Generate or import X.509 certificate
   ├── Store private key securely (encrypted)
   └── Certificate stored in database

3. Signing Process
   ├── User enters PIN to unlock private key
   ├── Create PAdES signature (PDF with embedded)
   └── Timestamp from TSA (Time Stamp Authority)

4. Verification
   ├── Signature validation
   ├── Certificate chain validation
   └── Timestamp verification
```

**Database Schema**:
```sql
CREATE TABLE signing_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    certificate_pem TEXT NOT NULL,
    public_key_pem TEXT NOT NULL,
    private_key_encrypted TEXT NOT NULL,
    key_fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE document_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    certificate_id UUID NOT NULL REFERENCES signing_certificates(id),
    signature_data BYTEA NOT NULL,
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    verification_status TEXT DEFAULT 'valid'
);
```

### Week 6: Polish

**Goal**: Performance optimization and monitoring

**Health Check Endpoints**:
- `GET /api/health` - Basic app health
- `GET /api/health/db` - Database connectivity
- `GET /api/health/scrapers` - Scraper status summary
- `GET /api/health/services` - External services status

**Performance Optimizations**:
- Database query optimization with indexes
- Caching for frequently accessed data
- CDN for static assets
- Lazy loading for components

**Final Checklist**:
- [ ] All tests passing
- [ ] CI/CD pipeline green
- [ ] Production deployment verified
- [ ] Backup strategy tested
- [ ] SSL certificates installed
- [ ] Monitoring dashboards configured
- [ ] Documentation updated

## File Structure Summary

### New Files to Create

```
backend/discovery/scheduler/
├── tier1.timer
├── tier1.service
├── tier2.timer
├── tier2.service
├── tier3.timer
├── tier3.service
└── scraper_runner.py

backend/discovery/email/
├── __init__.py
├── sender.py
├── templates.py
└── queue.py

backend/discovery/signatures/
├── __init__.py
├── pades.py
├── certificates.py
└── verification.py

frontend/lib/push/
├── subscribe.ts
├── send.ts
└── worker.ts

frontend/app/api/
├── cron/scrape/route.ts
├── health/route.ts
├── health/db/route.ts
├── health/scrapers/route.ts
└── health/services/route.ts
```

### Files to Modify

```
.github/workflows/ci.yml         # Update CI pipeline
frontend/lib/db/schema.ts        # Add email_queue, push_subscriptions, signing_certificates
frontend/lib/actions/opportunities.ts  # Add notification hooks
frontend/package.json            # Add test scripts, web-push
frontend/vitest.config.ts        # Configure coverage
```

## Success Criteria

1. **Data Freshness**: All 25 scraper sources run on schedule with <5% failure rate
2. **Test Coverage**: 70%+ coverage across backend and frontend
3. **CI/CD**: All tests pass before merge, automatic deployment on main
4. **Deployment**: HTTPS access, automated backups, PM2 process management
5. **Notifications**: Email alerts for scraper failures, deadline reminders working
6. **E-Signature**: PAdES signatures verifiable in Adobe Reader
7. **Performance**: Page load <3s, API response <500ms

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Scraper blocking | Stealth scraper fallback, proxy rotation |
| Email deliverability | SPF/DKIM/DMARC setup, warm-up period |
| Certificate management | Encrypted storage, PIN protection |
| Data loss | Daily backups, point-in-time recovery |
| Performance | Caching, query optimization, connection pooling |

## Dependencies

### Frontend
- `web-push` - Web push notifications
- `@noble/secp256k1` - Cryptographic operations for PAdES
- `pdf-lib` - PDF manipulation for signatures

### Backend
- `pypdf2` - PDF operations
- `cryptography` - Certificate handling
- `apscheduler` - Alternative to systemd timers

### System
- Postfix - Email delivery
- OpenSSL - Certificate generation
- systemd - Process management
