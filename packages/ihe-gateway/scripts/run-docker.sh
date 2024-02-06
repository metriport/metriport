#!/bin/bash

# Fail on error
set -e

source ./scripts/load-env.sh strict

source ./scripts/build-docker-dependencies.sh

docker compose -f docker-compose.yml up $1