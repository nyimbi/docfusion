---
id: task-042
title: "Phase 6: Observability dashboards for runtime"
status: To Do
phase: 6
gap_ids: [master-plan-§6.5]
priority: Medium
---

# task-042 - Phase 6: Observability dashboards for runtime

## Description (the why)

Without runtime observability, the first sign of trouble is a user report. Prometheus + Grafana dashboards for FastAPI, PostgreSQL, and LiteLLM give us latency/error/throughput visibility and let us set up alerts.

## Acceptance Criteria (the what)

- [ ] Prometheus scrapes metrics from: FastAPI (`/metrics`), PostgreSQL (via `postgres_exporter`), LiteLLM gateway.
- [ ] Grafana has three dashboards: API Latency, Database Health, LLM Cost & Latency.
- [ ] Each dashboard has at least three panels (requests/sec, p95 latency, error rate).
- [ ] Alert rules fire on: API error rate >5%, p95 latency >2s, DB replication lag >30s, LiteLLM failure rate >10%.
- [ ] Dashboards are committed as JSON under `deployment/grafana/dashboards/`.

## Implementation Plan (the how)

**Step 1: Instrument FastAPI.**

```bash
uv add prometheus-fastapi-instrumentator
```

In `src/docfusion/api/main.py`:

```python
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
```

**Step 2: Deploy postgres_exporter + prometheus + grafana.** Add to `docker-compose.yml`:

```yaml
prometheus:
  image: prom/prometheus:latest
  volumes:
    - ./deployment/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
  ports: ["9090:9090"]

grafana:
  image: grafana/grafana:latest
  environment:
    GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-admin}
  volumes:
    - ./deployment/grafana/dashboards:/var/lib/grafana/dashboards:ro
    - ./deployment/grafana/provisioning:/etc/grafana/provisioning:ro
  ports: ["3001:3000"]

postgres_exporter:
  image: prometheuscommunity/postgres-exporter:latest
  environment:
    DATA_SOURCE_NAME: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable"
  ports: ["9187:9187"]
```

**Step 3: Prometheus config.**

```yaml
# deployment/prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: fastapi
    static_configs:
      - targets: ['api:8000']

  - job_name: postgres
    static_configs:
      - targets: ['postgres_exporter:9187']

  - job_name: litellm
    static_configs:
      - targets: ['84.247.181.100:4000']
    metrics_path: /metrics
```

**Step 4: Grafana dashboards.** Author in the UI, export as JSON. Place under `deployment/grafana/dashboards/`:

- `api-latency.json` — request rate, p50/p95/p99 latency, error rate, slowest endpoints
- `database-health.json` — connection count, cache hit ratio, slow queries, replication lag
- `llm-costs.json` — tokens/min, cost/hour, failure rate, p95 latency

**Step 5: Alert rules.**

```yaml
# deployment/prometheus/alerts.yml
groups:
- name: docfusion
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
    for: 5m
  - alert: SlowP95Latency
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 10m
  - alert: DBReplicationLag
    expr: pg_replication_lag_seconds > 30
    for: 5m
  - alert: LiteLLMFailureRate
    expr: rate(litellm_requests_failed_total[5m]) / rate(litellm_requests_total[5m]) > 0.1
    for: 5m
```

Reference from `prometheus.yml`:

```yaml
rule_files:
  - /etc/prometheus/alerts.yml
```

**Step 6: Verify locally.**
```bash
docker compose up -d --wait
curl http://localhost:8000/metrics | head
curl http://localhost:9090/-/ready
curl http://localhost:3001/api/health
```

**Step 7: Commit.**
```bash
git add deployment/prometheus/ deployment/grafana/ docker-compose.yml src/docfusion/api/main.py pyproject.toml
git commit -m "feat(ops): Prometheus + Grafana observability stack [master-plan-§6.5]"
```

## Notes for less-capable agents

- Alert destinations (Slack, PagerDuty) are a separate task. This one only defines the rules.
- Do NOT commit Grafana admin credentials. Use `GRAFANA_ADMIN_PASSWORD` env var.
- If LiteLLM does not expose `/metrics`, skip that scrape job and note the limitation; we can add an exporter later.
