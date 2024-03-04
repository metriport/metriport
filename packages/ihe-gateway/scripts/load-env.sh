#!/bin/bash

# Fail on error
set -e

#################################################################################
#
# Load environment variables from a .env file.
# Pass 'strict' as the first argument to fail if no .env file is found.
#
#################################################################################

if ! [[ $DOT_ENV_FILE ]]; then
    DOT_ENV_FILE=.env
fi
echo "Loading environment variables from $DOT_ENV_FILE"

if [ -f $DOT_ENV_FILE ]; then
    set -o allexport
    source $DOT_ENV_FILE
    set +o allexport
else
    if [ "$1" == "strict" ]; then
        echo "Error: No $DOT_ENV_FILE file found"
        exit 1
    fi
    echo "Warning: No $DOT_ENV_FILE file found, expecting env vars to be set"
fi

if [[ -z "${ENV_TYPE}" ]]; then
    echo "Warning: ENV_TYPE is missing, default to 'staging'"
    set -o allexport
    ENV_TYPE="staging"
    set +o allexport
fi


if [ -z "${IHE_GW_URL_OUTBOUND}" ]; then
  echo "IHE_GW_URL_OUTBOUND is not set, looking for the IHE_GW_URL_INBOUND"
  if [ -z "${IHE_GW_URL_OUTBOUND}" ]; then
    echo "WARNING: no IHE GW URL env set"
  else
    IHE_GW_URL=$IHE_GW_URL_INBOUND
  fi
else
  IHE_GW_URL=$IHE_GW_URL_OUTBOUND
fi
