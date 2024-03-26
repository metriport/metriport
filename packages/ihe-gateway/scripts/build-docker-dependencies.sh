#!/bin/bash

# Stuff we need on docker container build time

if [ -z "${IHE_GW_FULL_BACKUP_LOCATION}" ]; then
  echo "Error: IHE_GW_FULL_BACKUP_LOCATION is not set, exiting"
  exit 1
fi

echo "Creating .secret files for Docker build..."
echo "$IHE_GW_KEYSTORE_STOREPASS" >"keystore_storepass.secret"
echo "$IHE_GW_KEYSTORE_KEYPASS" >"keystore_keypass.secret"

echo "Copying FullBackup-${ENV_TYPE}.xml..."
cp $IHE_GW_FULL_BACKUP_LOCATION/FullBackup-$ENV_TYPE.xml ./server/FullBackup.xml
