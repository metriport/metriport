#!/bin/bash
## This script pulls the per file post hapi resourcer count reference file from s3 and compares it to the file passed in as an argument


if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <file1>"
  exit 1
fi

FILE1=$1

FILE2="./src/fhir-converter/fhir-resource-counts/develop-post-hapi-fhir-resource-count.json"

if [ ! -f "$FILE2" ]; then
  echo "$FILE2 does not exist."
  exit 1
fi

jsondiffpatch "$FILE1" "$FILE2"