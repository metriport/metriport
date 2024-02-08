#!/bin/bash
# This script takes a JSON file as input, adds an index to each item in the array within the JSON file, and overwrites the original file with the updated content.
# Its useful for adding indexes to json files that are used in the templates

# Check if an argument is passed
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path_to_json_file>"
    exit 1
fi

# Assign the first argument as the file path
file_path="$1"

# Correctly add an index to each item in the array and overwrite the original file
jq 'to_entries | map({index: .key} + .value)' "$file_path" > temp.json && mv temp.json "$file_path"

echo "Indexes added successfully."