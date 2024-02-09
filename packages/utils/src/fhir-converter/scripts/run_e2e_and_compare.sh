#!/bin/bash
# This script runs the e2e-test.ts script without inserting to FHIR, and then runs the compare_total_resource_counts.sh script using the output from e2e-test.ts.

# Run the e2e-test.ts script and capture its output
OUTPUT=$(ts-node src/fhir-converter/e2e-test.ts)
echo "$OUTPUT"

# Extract the file1 location from the output
# Assuming the file location is printed in the format "File1 Location: /path/to/file1.json"
FILE1_LOCATION=$(echo "$OUTPUT" | grep "File1 Location:" | sed 's/File1 Location: //')

# Check if FILE1_LOCATION is empty
if [ -z "$FILE1_LOCATION" ]; then
  echo "Failed to extract file1 location from e2e-test.ts output."
  exit 1
fi

echo "Extracted file1 location: $FILE1_LOCATION"

# Run the run_jsondiffpatch.sh script with the extracted file location
.src/fhir-converter/scripts/compare_total_resource_counts.sh "$FILE1_LOCATION"