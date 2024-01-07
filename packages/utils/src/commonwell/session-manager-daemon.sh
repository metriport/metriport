#!/bin/bash

###################################################################################################
#
# Script that runs the `session-manager` to keep the CW session active for Enhanced Coverage.
# It's executed as a daemon on the temporary EC2 instance.
#
# Set CHECKLY_URL before using it.
#
###################################################################################################

. /home/ubuntu/.profile

cd /home/ubuntu/metriport/packages/utils

# disable errors (if checkly heartbeat fails we don't want to mess w/ session management
set +e

CHECKLY_OUTPUT=/home/ubuntu/checkly.out
CHECKLY_URL=...

while true; do
  echo Session Management daemon running at `date -Iseconds`

  # checkly heartbeat monitor
  echo -e "\n\nCalling Checkly at `date -Iseconds`" >> $CHECKLY_OUTPUT 2>&1
  (time curl -s -S -L -w "\nResponse code: %{http_code}\n" $CHECKLY_URL) >> $CHECKLY_OUTPUT 2>&1 & 

  # main script/logic
  /home/ubuntu/.nvm/versions/node/v18.14.2/bin/node dist/utils/src/commonwell/session-manager.js

  echo
  echo Waiting 5 min...
  sleep 300
  echo
done