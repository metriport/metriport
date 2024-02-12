#!/bin/bash
## This script compares the per resource count in a local file to that in @develop-fhir-resource-count.json.

# Check if one argument is passed
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <file1>"
  exit 1
fi

# Assign argument to a variable for better readability
FILE1=$1

# Assuming the script is run from the directory containing the fhir-converter-e2e folder
# and @develop-fhir-resource-count.json is located in the fhir-resource-counts directory
FILE2="./src/fhir-converter/fhir-resource-counts/develop-fhir-resource-count-per-file.json"

# Check if FILE2 exists
if [ ! -f "$FILE2" ]; then
  echo "$FILE2 does not exist."
  exit 1
fi

# Run jsondiffpatch
jsondiffpatch "$FILE1" "$FILE2"