# DocFusion Observability

This folder contains Grafana provisioning files, importable dashboard JSON, and the Promtail scrape snippet for DocFusion production runtime monitoring.

## Grafana deployment

Run these commands on the observability host, `217.76.53.144` (`mail.lindela.io`), as `root` from a checkout containing this repository:

```bash
ssh root@217.76.53.144
cp monitoring/provisioning/datasources.yaml /etc/grafana/provisioning/datasources/docfusion.yaml
cp monitoring/provisioning/dashboards.yaml /etc/grafana/provisioning/dashboards/docfusion.yaml
mkdir -p /etc/grafana/dashboards
cp monitoring/dashboards/*.json /etc/grafana/dashboards/
systemctl reload grafana-server
```

Grafana is expected at `http://217.76.53.144:3000`. The dashboards reference datasource UIDs `prometheus` and `loki`, matching `monitoring/provisioning/datasources.yaml`.

## Promtail deployment

On the DocFusion backend host, `37.60.225.7`, merge `monitoring/promtail-docfusion.yaml` into `/etc/promtail/config.yaml` under the top-level `scrape_configs` list, then reload Promtail:

```bash
ssh root@37.60.225.7
systemctl reload promtail
```

The Promtail snippet scrapes `/var/log/docfusion/*.log` with `job=docfusion`, `app=docfusion`, and `env=production`. It parses JSON log fields `level`, `duration_ms`, `source`, and `status`; it also extracts crawl and digest fields used by the dashboards.

If the production JSON log schema differs from the field names assumed here, adjust the LogQL queries and Promtail `json.expressions` mappings for `duration_ms`, `source`, `status`, `opportunities_discovered`, `crawl_duration_seconds`, `quality_kept`, and `quality_total`.
