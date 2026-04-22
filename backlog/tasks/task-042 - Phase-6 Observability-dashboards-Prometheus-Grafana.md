---
id: task-042
title: "Phase 6: Observability dashboards (Prometheus + Grafana)"
status: To Do
phase: 6
gap_ids: [master-plan-§6.5]
priority: Medium
---

# task-042 - Phase 6: Observability dashboards (Prometheus + Grafana)

## Description (the why)

Production needs visibility into FastAPI latency/error rates, PostgreSQL connection pool state, and LiteLLM gateway health. We instrument FastAPI with `prometheus-fastapi-instrumentator` and provide Grafana dashboard JSON.

## Acceptance Criteria (the what)

- [ ] FastAPI app exposes `/metrics` endpoint in Prometheus text format.
- [ ] Metrics include request count, request duration histogram, status code distribution.
- [ ] PostgreSQL connection pool gauge is exported (via `sqlalchemy` event listeners).
- [ ] LiteLLM call counter + latency histogram exported.
- [ ] Grafana dashboard JSON at `deployment/grafana/docfusion-overview.json` imports cleanly.
- [ ] `docker-compose.observability.yml` brings up Prometheus + Grafana locally.

## Implementation Plan (the how)

**Step 1: Install deps.**
```bash
uv add prometheus-fastapi-instrumentator prometheus-client
```

**Step 2: Instrument FastAPI.**

In `src/docfusion/api/main.py`:

```python
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

**Step 3: DB pool metrics.**

```python
# src/docfusion/observability/db_metrics.py
"""Prometheus metrics for the SQLAlchemy connection pool."""

from prometheus_client import Gauge
from sqlalchemy import event


class DbPoolMetrics:
	def __init__(self) -> None:
		self.pool_size = Gauge("docfusion_db_pool_size", "Current pool size")
		self.checked_out = Gauge("docfusion_db_pool_checked_out", "Connections checked out")

	def attach(self, engine) -> None:
		pool = engine.pool

		@event.listens_for(pool, "connect")
		def _on_connect(dbapi_conn, conn_record):
			self.pool_size.set(pool.size())

		@event.listens_for(pool, "checkout")
		def _on_checkout(*args, **kwargs):
			self.checked_out.set(pool.checkedout())


db_metrics = DbPoolMetrics()
```

Call `db_metrics.attach(engine)` after engine creation.

**Step 4: LiteLLM metrics.**

```python
# src/docfusion/observability/llm_metrics.py
from prometheus_client import Counter, Histogram

llm_calls_total = Counter("docfusion_llm_calls_total", "LiteLLM calls", ["model", "status"])
llm_latency_seconds = Histogram("docfusion_llm_latency_seconds", "LiteLLM call latency", ["model"])
```

In `LiteLLMClient.chat_completion`, wrap the HTTP call:

```python
import time
start = time.monotonic()
try:
	response = await self._call(...)
	llm_calls_total.labels(model=model, status="success").inc()
	return response
except Exception:
	llm_calls_total.labels(model=model, status="error").inc()
	raise
finally:
	llm_latency_seconds.labels(model=model).observe(time.monotonic() - start)
```

**Step 5: Prometheus config.**

```yaml
# deployment/prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: docfusion-api
    static_configs:
      - targets: ['api:8000']
    metrics_path: /metrics
```

**Step 6: Grafana dashboard.**

Create `deployment/grafana/docfusion-overview.json` with panels for:
- Request rate (`rate(http_requests_total[5m])`)
- p95 latency (`histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`)
- 5xx rate (`rate(http_requests_total{status=~"5.."}[5m])`)
- DB pool checked-out (`docfusion_db_pool_checked_out`)
- LLM call rate + latency

Use Grafana's "Export JSON" feature after building the dashboard once in the UI; commit the JSON.

**Step 7: Docker compose for local dev.**

```yaml
# docker-compose.observability.yml
services:
  prometheus:
    image: prom/prometheus:latest
    ports: ['9090:9090']
    volumes:
      - ./deployment/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
  grafana:
    image: grafana/grafana:latest
    ports: ['3001:3000']
    environment:
      GF_AUTH_ANONYMOUS_ENABLED: "true"
    volumes:
      - ./deployment/grafana:/var/lib/grafana/dashboards
```

**Step 8: Verify + commit.**
```bash
docker-compose -f docker-compose.yml -f docker-compose.observability.yml up -d
curl http://localhost:8000/metrics | head -30
# Expected: Prometheus-format metrics.
open http://localhost:9090  # Prometheus UI
open http://localhost:3001  # Grafana UI

git add src/docfusion/api/main.py src/docfusion/observability/ deployment/prometheus/ deployment/grafana/ docker-compose.observability.yml pyproject.toml
git commit -m "feat(ops): Prometheus + Grafana observability [master-plan-§6.5]"
```

## Notes for less-capable agents

- Do NOT expose `/metrics` on the public Internet without auth. In production, serve it on a separate internal port or gate behind VPN.
- Grafana dashboards drift — commit the JSON; treat it as source of truth. Any UI-edited change should be re-exported.
- If Prometheus can't reach the API from inside docker-compose, check that both are on the same network.
