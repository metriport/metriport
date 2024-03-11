#!/bin/bash

###################################################################################################
#
# Script to push configurations to the IHE Gateway.
#
# Usage:
#   ./scripts/push-to-server.sh [configurationMap|<include-full-backup>] [strict] [no-ssl-check]
#
# Arguments:
#   - configurationMap: Only push the configuration map to the server. If not present, push all
#                       configurations.
#   - include-full-backup: Include the full backup in the push (only when 'configurationMap' is
#                          not set).
#   - no-ssl-check: Skip the SSL certificate check.
#   - strict: If the server fails to accept the configuration map or check the SLL certs, stop
#             all Java processes.
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
    echo "[config] Non-strict mode: just leaving the config script..."
  fi
}
trap cleanup ERR

CONFIG_MAP_FILE=./server/ConfigurationMap.xml
MAX_ATTEMPTS_LOGIN=20
MAX_ATTEMPTS_VERIFY_SSL_CERT=15
MAX_ATTEMPTS_PUSH_CONFIG_MAP=10

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
    -u $ADMIN_USER:$ADMIN_PASSWORD \
    --data "$CONFIG_MAP")

  # If its not a number
  if ! isNumber $res; then
    echo "[config] Resp pushing configuration map to the server: $res" >/dev/stderr
    return 1
  elif [[ $res -ge 300 ]] || [[ $res -lt 200 ]]; then
    echo "[config] Resp pushing configuration map to the server: $res" >/dev/stderr
    return 2
  fi
  return 0
}

setConfigurationMap() {
  echo "[config] -- Config map only --"
  local counter=0
  until uploadConfigurationMap; do
    local resp=$?
    if [ $counter -ge $MAX_ATTEMPTS_PUSH_CONFIG_MAP ]; then
      echo "[config] Failed to push configuration map to the server, gave up."
      cleanup
      exit 1
    fi
    if [ $resp -eq 0 ]; then
      echo "[config] Configuration map pushed to the server."
      return 0
    elif [ $resp -eq 2 ]; then
      echo "[config] Failed to push configuration map to the server (won't retry)."
      cleanup
      exit 1
    fi
    echo "[config] Failed to push configuration map to the server, trying up to $MAX_ATTEMPTS_PUSH_CONFIG_MAP times..."
    counter=$((counter + 1))
    sleep 1
  done
}

setAllConfigs() {
  echo "[config] -- Full config --"

  if containsParameter "include-full-backup"; then
    # "-m" flag = "backup": only the FullBackup.xml file, equivalent to Mirth Administrator backup and restore
    ./scripts/mirthsync.sh -s $IHE_GW_URL -u $ADMIN_USER -p $ADMIN_PASSWORD -i -t ./server -m backup -f push
    # Wait for the server to process the backup to avoid failing to recognize the SSL certs and other recently loaded configs
    sleep 5
  fi

  # "-m" flag = "code" (default behavior): Expands everything to the most granular level (Javascript, Sql, etc).
  ./scripts/mirthsync.sh -s $IHE_GW_URL -u $ADMIN_USER -p $ADMIN_PASSWORD -i -t ./server --include-configuration-map -m code -f -d push
}

hasSSLCerts() {
  local sslCertResp=$(curl -s --header "X-Requested-With: push-to-server" -u $ADMIN_USER:$ADMIN_PASSWORD "$IHE_GW_URL/extensions/ssl/all")
  if [[ $sslCertResp == *"carequality"* ]]; then
    return 0
  fi
  echo "[config] SSL cert response: $sslCertResp" >/dev/stderr
  return 1
}

verifySSLCerts() {
  if containsParameter "no-ssl-check"; then
    echo "[config] Skipping SSL cert check"
    return
  fi
  echo "[config] Checking if SSL cert is there..."
  local counter=0
  until hasSSLCerts; do
    counter=$((counter + 1))
    if [ $counter -ge $MAX_ATTEMPTS_VERIFY_SSL_CERT ]; then
      echo "[config] SSL cert not found, gave up."
      cleanup
      exit 1
    fi
    echo "[config] SSL cert not found, trying up to $MAX_ATTEMPTS_VERIFY_SSL_CERT times..."
    sleep 1
  done
}

isApiAvailable() {
  local checkApiResult=$(curl -s --header "X-Requested-With: push-to-server" -u $ADMIN_USER:$ADMIN_PASSWORD -w '%{response_code}' -o /dev/null "$IHE_GW_URL/server/jvm")
  if [[ $checkApiResult -lt 100 ]]; then
    return 1 # not ready
  elif [[ $checkApiResult -ge 300 ]]; then
    echo "[config] Resp login to server: ${checkApiResult}" >/dev/stderr
    return 2 # failed login
  fi
  return 0 # ready
}

waitServerOnline() {
  echo "[config] Waiting for the web server to start... (${IHE_GW_URL})"
  until curl -s -f -o /dev/null $IHE_GW_URL; do
    sleep 1
  done

  echo "[config] Web server available, waiting for the API to start... (${IHE_GW_URL})"
  local counter=0
  until isApiAvailable; do
    local resp=$?
    counter=$((counter + 1))
    if [[ $resp -eq 0 ]]; then
      # ready
      sleep 2
      return 0
    elif [[ $resp -eq 2 ]]; then
      # failed login
      if [ $counter -ge $MAX_ATTEMPTS_LOGIN ]; then
        echo "[config] Too many incorrect login attempts, gave up."
        cleanup
        exit 1
      fi
      echo "[config] Failed to login to API, trying up to $MAX_ATTEMPTS_LOGIN times..."
    fi
    sleep 1
  done
}

###################################################################################################
#
# MAIN LOGIC
#
###################################################################################################
waitServerOnline

echo "[config] Pushing configs to the server..."
if containsParameter "configurationMap"; then
  # since we are only pushing the configuration map, we should first check if SSL certs are there
  verifySSLCerts
  setConfigurationMap
else
  # since we are pushing all configurations - which include the SSL certs, let's check certs afterwards
  setAllConfigs
  verifySSLCerts
fi

echo "[config] Done."
