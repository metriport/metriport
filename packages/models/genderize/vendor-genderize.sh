#!/usr/bin/env bash
set -euo pipefail

SRC_TS="${SRC_TS:-../../lambdas/src/genderize.ts}"
OUT_JS="lambda/handler.js"

mkdir -p lambda

npx --yes esbuild "$SRC_TS" \
  --bundle --platform=node --format=cjs --target=node20 \
  --outfile="$OUT_JS"
echo "Bundled -> $(realpath $OUT_JS)"
