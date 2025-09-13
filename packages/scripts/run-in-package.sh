#!/bin/bash

FILE_PATH="$1"
WORKSPACE_ROOT="$2"

# Extract package directory from file path
PACKAGE_DIR=$(echo "$FILE_PATH" | sed -n 's|.*\(packages/[^/]*\).*|\1|p')

if [ -z "$PACKAGE_DIR" ]; then
    echo "File is not in a packages/ directory"
    exit 1
fi

# Change to package directory
cd "$WORKSPACE_ROOT/$PACKAGE_DIR"

# Run based on extension
if [[ "$FILE_PATH" == *.js ]]; then
    node "$FILE_PATH"
elif [[ "$FILE_PATH" == *.ts ]]; then
    if ! command -v tsx &> /dev/null; then
        echo "Error: tsx is not installed. Please install it with 'brew install tsx'"
        exit 1
    fi
    tsx "$FILE_PATH"
else
    echo "Unsupported file type"
    exit 1
fi