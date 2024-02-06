#!/bin/bash

# Fail on error
set -e

echo "$IHE_GW_STOREPASS" > "store-pass.secret"
echo "$IHE_GW_KEYSTOREPASS" > "keystore-pass.secret"

# Intentionally setting the storepass using the value of keystorepass
# Also built on ihe-gw-construct.ts
echo -e "\
keystore.path=\${dir.appdata}/$IHE_GW_KEYSTORENAME
keystore.storepass=$IHE_GW_KEYSTOREPASS
keystore.keypass=$IHE_GW_KEYSTOREPASS
keystore.type=pkcs12" > secret.properties
