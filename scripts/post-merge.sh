#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Install the root application's locked dependencies without prompts.
CI=true npm ci --no-audit --no-fund --no-progress

# Rebuild the generated assets consumed by wrangler.jsonc.
npm run build:cloudflare
