#!/bin/bash
npm run lint:hbs
LINT_RESULTS=$(npm run postprocess-hbs-lint)
echo "$LINT_RESULTS"

# Check if the output is not empty
if [ ! -z "$LINT_RESULTS" ]; then
  echo "Linting issues found:"
  echo "$LINT_RESULTS"
  exit 1
else
  echo "No linting issues found."
fi

rm lint-results.txt