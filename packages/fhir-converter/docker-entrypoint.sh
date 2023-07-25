#!/bin/bash

# Get memory information based on the OS
if [[ $OSTYPE == 'darwin'* ]]; then
  FREE_FINAL=$(( $(sysctl -a | awk '/memsize/{print $2}') / 2**20 ));
else
  # Not using "free -m" because the docker container is a "slim" one based on Debian
  FREE=$(awk '/MemFree/ { printf "%.3f \n", $2/1024 }' /proc/meminfo)
  # Converts to integer
  FREE_FINAL=${FREE%.*}
fi
# Calculates the ideal memory limit based on the available memory and try to leave 512MB for the OS
# If less than 128MB, set to 128MB
FREE_IDEAL=$(($FREE_FINAL-512))
if [[ FREE_IDEAL -lt 128 ]]
then
  MEM_LIMIT=128
else
  MEM_LIMIT=$(($FREE_IDEAL))
fi
# Just in case it failed to calculate, set to 4GB less some space for the OS
MEMORY_LIMIT="${MEM_LIMIT:=3584}";
# Export the NODE_OPTIONS environment variable setting the memory limit to NodeJS
export NODE_OPTIONS="--max-old-space-size=${MEMORY_LIMIT}"
echo "NODE_OPTIONS: ${NODE_OPTIONS}"

# Start the application
npm start
