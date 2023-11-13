#!/bin/bash
# File: eslint-custom.sh
# Usage: ./eslint-custom.sh file1.ts file2.ts ...

# Array of files to lint
FILES_TO_LINT=("$@")

# Base directory to exclude
EXCLUDE_DIR="packages/sdks"

# Loop over the files
for FILE in "${FILES_TO_LINT[@]}"; do
  if [[ $FILE != $EXCLUDE_DIR* ]]; then
    # File is outside the excluded directory, enforce max-warnings=0
    eslint --max-warnings=0 "$FILE"
  else
    # File is inside the excluded directory, run without max-warnings
    eslint "$FILE"
  fi
done
