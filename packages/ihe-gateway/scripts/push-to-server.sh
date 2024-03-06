#!/bin/bash

###################################################################################################
#
# Script to push configurations to the IHE Gateway.
#
# Usage:
#   ./scripts/push-to-server.sh [configurationMap] [strict]
#
# Arguments:
#   - configurationMap: Only push the configuration map to the server. If not present, push all
#                       configurations.
#   - strict: If the server fails to accept the configuration map, stop all Java processes.
#
###################################################################################################

# Fail on error
set -eo pipefail
set -eE # same as: `set -o errexit -o errtrace`

cleanup() {
  if containsElement "strict"; then
    echo "[config] Strict mode: stopping all Java processes..."
    pkill java
  else
    echo "[config] Non-strict mode, just leaving..."
  fi
}
trap cleanup ERR

CONFIG_MAP_FILE=./server/ConfigurationMap.xml
MAX_LOGIN_ATTEMPTS=5
INCORRECT_LOGIN_ATTEMPTS=0

source ./scripts/load-env.sh
source ./scripts/load-default-server-url.sh

ARGUMENTS=("$@")

containsElement() {
  for i in "${ARGUMENTS[@]}"; do
    if [ "$i" == "$1" ]; then
      return 0
    fi
  done
  return 1
}

isNumber() {
  if [[ $1 =~ ^[0-9]+$ ]]; then
    return 0
  else
    return 1
  fi
}

uploadConfigurationMapRes=999
uploadConfigurationMap() {
  echo "[config] -- Config map only --"
  if [ -f $CONFIG_MAP_FILE ]; then
    CONFIG_MAP=$(cat $CONFIG_MAP_FILE)
  else
    echo "[config] Error: Configuration map file not found."
    exit 1
  fi

  local res=$(curl -s -w '%{response_code}' --request PUT "$IHE_GW_URL/server/configurationMap" \
    --header "X-Requested-With: push-to-server" \
    --header 'Accept: application/xml' \
    --header 'Content-Type: application/xml' \
    -u $IHE_GW_USER:$IHE_GW_PASSWORD \
    --data "$CONFIG_MAP")

  # If its not a number
  if ! isNumber $res; then
    uploadConfigurationMapRes="not-number"
  elif [[ $res -ge 300 ]] || [[ $res -lt 200 ]]; then
    uploadConfigurationMapRes="not-success"
  fi
}

setConfigurationMap() {
  for i in {1..3}; do
    uploadConfigurationMap
    if [ $uploadConfigurationMapRes == "not-number" ]; then
      echo "[config] Failed to push configuration map to the server, trying up to 3 times - Result: $uploadConfigurationMapRes"
    elif [ $uploadConfigurationMapRes == "not-success" ]; then
      echo "[config] Failed to push configuration map to the server - Result: $uploadConfigurationMapRes"
      cleanup
      exit 1
    else
      echo "[config] Configuration map pushed to the server."
      return
    fi
    sleep 1
  done
  cleanup
  exit 1
}

setAllConfigs() {
  echo "[config] -- Full config --"
  # "-m" flag = "backup": only the FullBackup.xml file, equivalent to Mirth Administrator backup and restore
  ./scripts/mirthsync.sh -s $IHE_GW_URL -u $IHE_GW_USER -p $IHE_GW_PASSWORD -i -t ./server -m backup -f push
  # "-m" flag = default behavior: Expands everything to the most granular level (Javascript, Sql, etc).
  ./scripts/mirthsync.sh -s $IHE_GW_URL -u $IHE_GW_USER -p $IHE_GW_PASSWORD -i -t ./server --include-configuration-map -f -d push
}

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
echo "[config] Pushing configs to the server..."
if containsElement "configurationMap"; then
  setConfigurationMap
else
  setAllConfigs
fi
echo "[config] Done."
