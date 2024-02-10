#!/bin/bash

# Fail on error
set -e

if [ -z "${IHE_GW_FULL_BACKUP_LOCATION}" ]; then
    echo "Error: IHE_GW_FULL_BACKUP_LOCATION is not set, exiting"
    exit 1
fi
