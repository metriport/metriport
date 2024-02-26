#!/bin/bash

# Fail on error
set -e

#################################################################################
#
# Load environment variables from a .env file.
# Pass 'strict' as the first argument to fail if no .env file is found.
#
#################################################################################

if ! [[ $FILE ]]; then
    FILE=.env
fi

if [ -f $FILE ]; then
    set -o allexport
    source $FILE
    set +o allexport
else
    if [ "$1" == "strict" ]; then
        echo "Error: No .env file found"
        exit 1
    fi
    echo "Warning: No .env file found, expecting env vars to be set"
fi
