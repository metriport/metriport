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
set -o pipefail
set -o errtrace
set -e

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

setConfigurationMap() {
  echo "[config] -- Config map only --"
  if [ -f $CONFIG_MAP_FILE ]; then
    CONFIG_MAP=$(cat $CONFIG_MAP_FILE)
  else
    echo "[config] Error: Configuration map file not found."
    exit 1
  fi

  RESULT=$(curl -s -w '%{response_code}' --request PUT "$IHE_GW_URL/server/configurationMap" \
    --header "X-Requested-With: push-to-server" \
    --header 'Accept: application/xml' \
    --header 'Content-Type: application/xml' \
    -u $IHE_GW_USER:$IHE_GW_PASSWORD \
    --data "$CONFIG_MAP")

  if [[ $RESULT -ge 300 ]] || [[ $RESULT -lt 200 ]]; then
    echo "[config] Failed to push configuration map to the server - Result: $RESULT"
    cleanup
    exit 1
  else
    echo "[config] Configuration map pushed to the server."
  fi
}

setAllConfigs() {
  echo "[config] -- Full config --"
  # "-m" flag = "backup": only the FullBackup.xml file, equivalent to Mirth Administrator backup and restore
  ./scripts/mirthsync.sh -s $IHE_GW_URL -u $IHE_GW_USER -p $IHE_GW_PASSWORD -i -t ./server -m backup -f push
  # "-m" flag = default behavior: Expands everything to the most granular level (Javascript, Sql, etc).
  ./scripts/mirthsync.sh -s $IHE_GW_URL -u $IHE_GW_USER -p $IHE_GW_PASSWORD -i -t ./server --include-configuration-map -f -d push
}

waitServerOnline() {
  echo "[config] Waiting for the server to start... (${IHE_GW_URL})"
  until curl -s --header "X-Requested-With: push-to-server" -u $IHE_GW_USER:$IHE_GW_PASSWORD -o /dev/null "$IHE_GW_URL/server/jvm"; do
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
