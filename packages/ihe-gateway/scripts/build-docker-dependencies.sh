#!/bin/bash

# Stuff we need on docker container build time

echo "$IHE_GW_KEYSTORE_STOREPASS" >"keystore_storepass.secret"
echo "$IHE_GW_KEYSTORE_KEYPASS" >"keystore_keypass.secret"
