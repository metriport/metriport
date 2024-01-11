#!/bin/bash

# Fail on error
set -e

source ./scripts/load-env.sh
source ./scripts/check-env.sh

# "-m" flag: only the FullBackup.xml file, "Equivalent to Mirth Administrator backup and restore"
./scripts/mirthsync.sh -s $IHE_GW_URL -u $IHE_GW_USER -p $IHE_GW_PASSWORD -i -t $IHE_GW_FULL_BACKUP_LOCATION -m backup -f push

# "-m" flag: default behavior. Expands everything to the most granular level (Javascript, Sql, etc).
./scripts/mirthsync.sh -s $IHE_GW_URL -u $IHE_GW_USER -p $IHE_GW_PASSWORD -i -t ./server --include-configuration-map -f -d push