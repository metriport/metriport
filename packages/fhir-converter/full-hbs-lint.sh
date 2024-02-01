#!/bin/bash
npm run lint:hbs
LINT_RESULTS=$(node postprocess-hbs-lint.js)

# Check if the output is not empty
if [ ! -z "$LINT_RESULTS" ]; then
  echo "Linting issues found:"
  echo "$LINT_RESULTS"
  echo -e
  rm lint-results.txt
  exit 1
else
  echo -e "\033[34m→\033[0m No linting issues found"
  rm lint-results.txt
fi