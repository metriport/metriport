#!/bin/bash
# A helper script to count the total number of resources in the json file in case you forget

# Check if an argument is passed
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path_to_json_file>"
    exit 1
fi

# Assign the first argument as the file path
FILE_PATH="$1"

# Sum up the "total" fields from each JSON object
TOTAL_SUM=$(jq '[.[] | .total] | add' "$FILE_PATH")

echo "Total number of resources: $TOTAL_SUM"
