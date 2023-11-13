#!/bin/bash
# File: eslint-custom.sh

# Directories to exclude
EXCLUDE_DIR="packages/sdks"

INCLUDED_FILES=()
EXCLUDED_FILES=()

# Sort files into included and excluded arrays
for FILE in "$@"; do
  if [[ "$FILE" != "$EXCLUDE_DIR"* ]]; then
    INCLUDED_FILES+=("$FILE")
  else
    EXCLUDED_FILES+=("$FILE")
  fi
done

# Run ESLint on included files with max-warnings=0
if [ ${#INCLUDED_FILES[@]} -ne 0 ]; then
  eslint --max-warnings=0 "${INCLUDED_FILES[@]}"
fi

# Run ESLint on excluded files without max-warnings=0
if [ ${#EXCLUDED_FILES[@]} -ne 0 ]; then
  eslint "${EXCLUDED_FILES[@]}"
fi
