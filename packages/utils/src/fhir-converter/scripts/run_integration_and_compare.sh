#!/bin/bash
# This script runs the integration-test.ts script without inserting to FHIR, and then runs the compare_total_resource_counts.sh script using the output from integration-test.ts.

# Run the integration-test.ts script and capture its output
OUTPUT=$(ts-node src/fhir-converter/integration-test.ts)
echo "$OUTPUT"

# Extract the file1 location from the output
# Assuming the file location is printed in the format "File1 Location: /path/to/file1.json"
FILE1_LOCATION=$(echo "$OUTPUT" | grep "File1 Location:" | sed 's/File1 Location: //')

# Check if FILE1_LOCATION is empty
if [ -z "$FILE1_LOCATION" ]; then
  echo "Failed to extract file1 location from integration-test.ts output."
  exit 1
fi

echo "Extracted file1 location: $FILE1_LOCATION"

echo "Current working directory: $(pwd)"

# Run the run_jsondiffpatch.sh script with the extracted file location
./src/fhir-converter/scripts/compare_total_resource_counts.sh "$FILE1_LOCATION"