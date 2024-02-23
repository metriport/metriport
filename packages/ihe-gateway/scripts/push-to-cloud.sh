#!/bin/bash

# Fail on error
set -e

###################################################################################################
#
# Sends configs to a task on the cloud and restarts both inbound and outbound services.
#
###################################################################################################

Help()
{
   # Display Help
   echo "Script push config to the IHE GW."
   echo "Run from the packages/ihe-gateway/ folder."
   echo
   echo "Syntax: ./scripts/push-to-cloud.sh [h|e]"
   echo "options:"
   echo "h     Print this Help."
   echo "e     The environment to which to deploy to. Must be one of production|staging"
   echo
   echo "Example: ./scripts/push-to-cloud.sh -e \"staging\""
   echo
}

Execute()
{
  FILE=".env.$1"
  echo "Loading environment variables from $FILE"
  source ./scripts/push-to-server.sh

  echo "Restarting the outbound service"
  set -o allexport
  ECS_SERVICE=$ECS_SERVICE_OUTBOUND
  set +o allexport
  ../scripts/restart-ecs.sh &

  echo "Restarting the inbound service"
  set -o allexport
  ECS_SERVICE=$ECS_SERVICE_INBOUND
  set +o allexport
  ../scripts/restart-ecs.sh &

  set -o allexport
  ECS_SERVICE=""
  set +o allexport

  echo "Waiting for them to finish..."
  wait
  echo "Done."
}

############################################################
# Process the input options.                               #
############################################################
# Get the options
while getopts ":he:" option; do
   case $option in
      h) # display Help
         Help
         exit;;
      e) # the environment to deploy to
         env=$OPTARG;;
      \?) # Invalid option
          echo "Error: Invalid option"
          exit;;
   esac
done

if [[ "$env" =~ ^production$ ]]; then
    Execute production
elif [[ "$env" =~ ^staging$ ]]; then
    Execute staging
else
    echo "Invalid environment! -e must be one of production|staging"
fi
