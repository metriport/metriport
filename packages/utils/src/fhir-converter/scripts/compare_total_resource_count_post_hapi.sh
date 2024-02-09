#!/bin/bash
## This script pulls the per file post hapi resourcer count reference file from s3 and compares it to the file passed in as an argument


# Check if one argument is passed
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <file1>"
  exit 1
fi

# Assign argument to a variable for better readability
FILE1=$1

# Fixed S3 path for file2
S3_FILE2="s3://fhir-resource-count/develop-fhir-resource-count-post-hapi.json"

# Temporary file to store the downloaded S3 file
TMP_FILE2=$(mktemp)

# Download file2 from S3, suppressing stdout but keeping stderr
if aws s3 cp "$S3_FILE2" "$TMP_FILE2" > /dev/null; then
  echo "File downloaded successfully, running jsondiffpatch."
else
  echo "Failed to download $S3_FILE2"
  exit 1
fi

# Run jsondiffpatch
jsondiffpatch "$FILE1" "$TMP_FILE2"

rm "$TMP_FILE2"