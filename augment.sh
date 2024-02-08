#!/bin/bash

file_path="packages/utils/output/runs-fhir-converter-e2e-2024-02-07T02:45:31.695Z-output-resource-counts.json"

# Correctly add an index to each item in the array and overwrite the original file
jq 'to_entries | map({index: .key} + .value)' "$file_path" > temp.json && mv temp.json "$file_path"

echo "Indexes added successfully."