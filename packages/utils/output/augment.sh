#!/bin/bash

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