---
id: TASK-050
title: Add Caddy reverse proxy + TLS for spare-2
status: To Do
assignee: []
created_date: '2026-08-13 23:16'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently frontend and API on spare-2 serve HTTP on bare IPs. Add Caddy config for HTTPS termination proxying :8000 (API) and :3000 (frontend). Required for real user traffic and Keycloak OIDC (which needs https). Update NEXTAUTH_URL and Keycloak client redirect URIs at same time.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Caddyfile in deployment/ committed,systemd unit for caddy (or apt package with config),NEXTAUTH_URL updated in fill-env.sh,Keycloak client redirect_uris updated,caddy validate passes before reload
<!-- AC:END -->
