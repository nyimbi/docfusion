#!/usr/bin/env bash
set -euo pipefail
echo "Deploying docfusion locally..."
cd "$(dirname "$0")/../../.."
uv sync
echo "Done."
