#!/bin/bash

# Script geared towards the running environment on an EC2 instance

date
 # load NODE_OPTS env var
. /home/ubuntu/.profile
cd /home/ubuntu/metriport/packages/utils
# disable errors (if checkly heartbeat fails we don't want to mess w/ session management
set +e

while true; do
  # checkly heartbeat monitor
  curl https://ping.checklyhq.com/05faf9da-51eb-489a-8c92-126c09c52763

  # main script/logic
  /home/ubuntu/.nvm/versions/node/v18.14.2/bin/node dist/utils/src/commonwell/session-manager.js;

  echo "";
  echo "Waiting 5 min...";
  sleep 300;
  echo "";
done