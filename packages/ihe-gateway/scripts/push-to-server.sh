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
#   - no-ssl-check: Skip the SSL certificate check.
#
###################################################################################################

# Fail on error
set -eo pipefail
set -eE # same as: `set -o errexit -o errtrace`

cleanup() {
  if containsParameter "strict"; then
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

containsParameter() {
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
    return 1
  elif [[ $res -ge 300 ]] || [[ $res -lt 200 ]]; then
    return 2
  fi
  return 0
}

setConfigurationMap() {
  local counter=0
  until uploadConfigurationMap; do
    local resp=$?
    if [ $counter -ge 3 ]; then
      echo "[config] Failed to push configuration map to the server, gave up - Result: $resp"
      cleanup
      exit 1
    fi
    if [ $resp -eq 0 ]; then
      echo "[config] Configuration map pushed to the server."
      return 0
    elif [ $resp -eq 2 ]; then
      echo "[config] Failed to push configuration map to the server - Result: $resp"
      cleanup
      exit 1
    fi
    echo "[config] Failed to push configuration map to the server, trying up to 3 times - Result: $resp"
    counter=$((counter + 1))
    sleep 1
  done
}

setAllConfigs() {
  echo "[config] -- Full config --"
  # "-m" flag = "backup": only the FullBackup.xml file, equivalent to Mirth Administrator backup and restore
  ./scripts/mirthsync.sh -s $IHE_GW_URL -u $IHE_GW_USER -p $IHE_GW_PASSWORD -i -t ./server -m backup -f push

  # Wait for the server to process the backup to avoid failing to recognize the SSL certs and other recently loaded configs
  sleep 5

  # "-m" flag = default behavior: Expands everything to the most granular level (Javascript, Sql, etc).
  ./scripts/mirthsync.sh -s $IHE_GW_URL -u $IHE_GW_USER -p $IHE_GW_PASSWORD -i -t ./server --include-configuration-map -f -d push
}

hasSSLCerts() {
  local sslCertResp=$(curl -s --header "X-Requested-With: push-to-server" -u $IHE_GW_USER:$IHE_GW_PASSWORD "$IHE_GW_URL/extensions/ssl/all")
  if [[ $sslCertResp == *"carequality"* ]]; then
    return 0
  fi
  return 1
}

verifySSLCerts() {
  echo "[config] Checking if SSL cert is there..."
  local counter=0
  until hasSSLCerts; do
    if [ $counter -ge 3 ]; then
      echo "[config] SSL cert not found, gave up - Result: $resp"
      cleanup
      exit 1
    fi
    echo "[config] SSL cert not found, trying up to 3 times - Result: $resp"
    counter=$((counter + 1))
    sleep 1
  done
}

isApiAvailable() {
  local checkApiResult=$(curl -s --header "X-Requested-With: push-to-server" -u $IHE_GW_USER:$IHE_GW_PASSWORD -w '%{response_code}' -o /dev/null "$IHE_GW_URL/server/jvm")
  if [[ $checkApiResult -lt 100 ]]; then
    echo "[config] Resp from API: ${checkApiResult}"
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
  echo "[config] Web available, waiting for the API to start... (${IHE_GW_URL})"
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

if containsParameter "no-ssl-check"; then
  echo "[config] Skipping SSL cert check..."
else
  verifySSLCerts
fi

echo "[config] Pushing configs to the server..."

if containsParameter "configurationMap"; then
  setConfigurationMap
else
  setAllConfigs
fi
echo "[config] Done."
