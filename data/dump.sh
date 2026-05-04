#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

pg_dump "$DATABASE_URL" > docfusion.sql
