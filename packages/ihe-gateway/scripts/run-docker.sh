#!/bin/bash

# Fail on error
set -e

source ./scripts/load-env.sh strict

source ./scripts/build-docker-dependencies.sh

set -o allexport
# Env vars are passed to IHE GW through _MP_ prefixed env vars, see entrypoint.sh
_MP_KEYSTORE_PATH=\${dir.appdata}/$IHE_GW_KEYSTORE_NAME
# Intentionally setting the storepass using the value of keystorepass
_MP_KEYSTORE_STOREPASS=$IHE_GW_KEYSTORE_KEYPASS
_MP_KEYSTORE_KEYPASS=$IHE_GW_KEYSTORE_KEYPASS
_MP_KEYSTORE_TYPE=$IHE_GW_KEYSTORE_TYPE
set +o allexport

docker compose -f docker-compose.yml up -d $1

echo "Waiting for the server to start..."
until curl -s -f -o /dev/null $IHE_GW_URL
do
  sleep 1
  echo -n "."
done
echo

source ./scripts/push-to-server.sh