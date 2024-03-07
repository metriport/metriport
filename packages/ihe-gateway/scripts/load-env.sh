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
