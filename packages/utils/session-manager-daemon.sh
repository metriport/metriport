#!/bin/bash

# Script geared towards the running environment on an EC2 instance

date

. /home/ubuntu/.profile

cd /home/ubuntu/metriport/packages/utils

while true; do
  /home/ubuntu/.nvm/versions/node/v18.14.2/bin/node dist/utils/src/commonwell/session-manager.js;
  echo "";
  echo "Waiting 5 min...";
  sleep 300;
  echo "";
done