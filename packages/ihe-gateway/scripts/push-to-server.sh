#!/bin/bash

# Fail on error
set -e

source ./scripts/load-env.sh

echo "[config] Waiting for the server to start... (${IHE_GW_URL})"
until curl -s -f -o /dev/null $IHE_GW_URL; do
  sleep 1
done
echo "[config] Pushing configs to the server..."

# "-m" flag: only the FullBackup.xml file, "Equivalent to Mirth Administrator backup and restore"
./scripts/mirthsync.sh -s $IHE_GW_URL -u $IHE_GW_USER -p $IHE_GW_PASSWORD -i -t ./server -m backup -f push

# "-m" flag: default behavior. Expands everything to the most granular level (Javascript, Sql, etc).
./scripts/mirthsync.sh -s $IHE_GW_URL -u $IHE_GW_USER -p $IHE_GW_PASSWORD -i -t ./server --include-configuration-map -f -d push

echo "[config] Done."
