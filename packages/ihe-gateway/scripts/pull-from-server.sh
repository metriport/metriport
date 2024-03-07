#!/bin/bash

# Fail on error
set -e

source ./scripts/load-env.sh

source ./scripts/load-default-server-url.sh

if [[ -z "${ENV_TYPE}" ]]; then
  echo "Warning: ENV_TYPE is missing, default to 'staging'"
  set -o allexport
  ENV_TYPE="staging"
  set +o allexport
fi
if [ -z "${IHE_GW_FULL_BACKUP_LOCATION}" ]; then
  echo "Error: IHE_GW_FULL_BACKUP_LOCATION is not set, exiting"
  exit 1
fi

isApiAvailable() {
  local checkApiResult=$(curl -s --header "X-Requested-With: push-to-server" -u $IHE_GW_USER:$IHE_GW_PASSWORD -w '%{response_code}' -o /dev/null "$IHE_GW_URL/server/jvm")
  if [[ $checkApiResult -lt 100 ]]; then
    return 1 # not ready
  elif [[ $checkApiResult -ge 300 ]]; then
    echo "[config] Failed login to server, trying up to $MAX_LOGIN_ATTEMPTS times - Result: $checkApiResult" >/dev/stderr
    if [ $INCORRECT_LOGIN_ATTEMPTS -ge $MAX_LOGIN_ATTEMPTS ]; then
      echo "[config] Too many incorrect login attempts, stopping..."
      cleanup
      exit 1
    fi
    INCORRECT_LOGIN_ATTEMPTS=$((INCORRECT_LOGIN_ATTEMPTS + 1))
  fi
  return 0
}

waitServerOnline() {
  echo "[config] Waiting for the server to start... (${IHE_GW_URL})"
  until curl -s -f -o /dev/null $IHE_GW_URL; do
    sleep 1
  done
  until isApiAvailable; do
    sleep 1
  done
  sleep 2
}

###################################################################################################
#
# MAIN LOGIC
#
###################################################################################################
waitServerOnline

# clear out the server directory because mirthsync doesn't remove files that are no longer on the server
rm -rf ./server/Channels
rm -rf ./server/CodeTemplates
rm -rf ./server/GlobalScripts

# "-m" flag = default behavior: Expands everything to the most granular level (Javascript, Sql, etc).
./scripts/mirthsync.sh -s $IHE_GW_URL -u $IHE_GW_USER -p $IHE_GW_PASSWORD -i -t ./server --include-configuration-map -f pull

# "-m" flag = "backup": only the FullBackup.xml file, equivalent to Mirth Administrator backup and restore
./scripts/mirthsync.sh -s $IHE_GW_URL -u $IHE_GW_USER -p $IHE_GW_PASSWORD -i -t $IHE_GW_FULL_BACKUP_LOCATION --include-configuration-map -m backup -f pull

mv $IHE_GW_FULL_BACKUP_LOCATION/FullBackup.xml $IHE_GW_FULL_BACKUP_LOCATION/FullBackup-$ENV_TYPE.xml

echo "[config] Done."
