#!/bin/bash

# Inspired by https://gist.github.com/bigomega/4de7dbc395be0e0f33b4
# TODO: allow multiple headers
# TODO: call curl with optional parameters so the code is not duplicated (DRY)

############################################################
# Help                                                     #
############################################################
Help()
{
   # Display Help
   echo
   echo "Syntax: load-test.sh -[h|u|r|H|d]"
   echo "options:"
   echo "  h - Print this help."
   echo "  u - The URL to be executed/called"
   echo "  r - The rate of calls per second"
   echo "  H - [optional] The header to be passed to curl"
   echo "  d - [optional] The data to be passed to curl (POST)"
   echo
   echo "Example: load-test.sh -r 10 -u \"http://domain.com/path\""
   echo
}

############################################################
# Execute                                                  #
############################################################
Execute () {
  if [ "$header" ]; then
    if [[ "$data" ]]; then
      curl -s -v "$url" --header "$header" --data "$data" --header "Content-Type: application/json" 2>&1 | tr '\r\n' '\n' | awk -v date="$(date '+%Y-%m-%dT%H:%M:%S')" '{print date $0}' >> /tmp/perf-test.log
    else
      curl -s -v "$url" --header "$header" 2>&1 | tr '\r\n' '\\n' | awk -v date="$(date '+%Y-%m-%dT%H:%M:%S')" '{print date $0}' >> /tmp/perf-test.log
    fi
  else
    if [[ "$data" ]]; then
      curl -s -v "$url" --data "$data" --header "Content-Type: application/json" 2>&1 | tr '\r\n' '\\n' | awk -v date="$(date '+%Y-%m-%dT%H:%M:%S')" '{print date $0}' >> /tmp/perf-test.log
    else
      curl -s -v "$url" 2>&1 | tr '\r\n' '\n' | awk -v date="$(date '+%Y-%m-%dT%H:%M:%S')" '{print date $0}' >> /tmp/perf-test.log
    fi
  fi
}

############################################################
# Main                                                     #
############################################################
Main () {
  echo "URL: $url"
  echo "Rate: $rate"
  echo "Header: $header"
  echo "Data: $data"
  echo "Starting load test in 2s..."
  sleep 2
  while true
  do
    echo $(($(date +%s) - START)) | awk '{print int($1/60)":"int($1%60)}'
    sleep 1

    for i in `seq 1 $rate`
    do
      Execute &
    done
  done
}

############################################################
# Plumbing                                                 #
############################################################
while getopts ":hu:r:H:d:" option; do
   case $option in
      h) Help
         echo "Simple load test script."
         exit;;
      u) url=$OPTARG;;
      r) rate=$OPTARG;;
      H) header=$OPTARG;;
      d) data=$OPTARG;;
      \?) echo "Error: Invalid option"
          exit;;
   esac
done

if [[ -z "$url" ]]; then
    echo "No URL specified"
    Help
    exit
fi
if [[ -z "$rate" ]]; then
    echo "No rate specified"
    Help
    exit
fi

Main