#!/bin/bash

# Fail on error
set -e

source ./scripts/load-env.sh strict

echo "$STOREPASS" > "store-pass.secret"
echo "$KEYSTOREPASS" > "keystore-pass.secret"
echo "$LICENSE_KEY" > "license-key.secret"

# Intentionally setting the storepass using the value of keystorepass
# Also built on ihe-gw-construct.ts
echo -e "\
keystore.path=\${dir.appdata}/$KEYSTORENAME
keystore.storepass=$KEYSTOREPASS
keystore.keypass=$KEYSTOREPASS
keystore.type=pkcs12" > secret.properties


docker compose -f docker-compose.yml up $1