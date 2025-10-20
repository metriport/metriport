#!/usr/bin/env bash

# Don't fail on error
set +e
# Don't echo commands
set +x

# Read workspaces from package.json and populate packages array
packages=($(cat package.json | grep -o '"packages/[^"]*"' | sed 's/"packages\///g' | sed 's/"//g'))

echo "Running tests for packages: ${packages[@]}"

# Run tests for each package
parallel --halt never,fail=1 --keep-order --line-buffer 'FORCE_COLOR=true npm run test -w packages/{}' ::: "${packages[@]}"

if [ $? -eq 0 ]; then
  echo -e "\n\033[1;32mTests passed\033[0m"
else
  echo -e "\n\033[1;31m>>> Tests failed <<<\\033[0m"
  exit 1
fi
