#!/bin/bash

# Fail on error
set -e

if [ -f ../.env ]; then
    set -o allexport
    source .env
    set +o allexport
else
    echo "No .env file found, expecting env vars to be set"
fi
