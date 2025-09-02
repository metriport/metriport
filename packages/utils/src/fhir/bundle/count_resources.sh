#!/bin/bash

# Script to count entries per resourceType for all JSON files in a folder
# 
# This script processes JSON files that contain FHIR Bundle structures with .entry arrays
# and counts the number of entries for each resourceType found in the files.
#
# Usage: ./count_resources.sh [directory_path]
# 
# Examples:
#   ./count_resources.sh                   # Process current directory
#   ./count_resources.sh ./data            # Process ./data directory
#   ./count_resources.sh /path/to/files    # Process specific directory
#
# Requirements:
#   - jq must be installed (https://stedolan.github.io/jq/)
#   - JSON files must have .entry array structure (FHIR Bundle format)
#
# Output format:
#   File: filename.json
#   ----------------------------------------
#   Patient              : 5
#   Encounter            : 3
#   Observation          : 10
#   -------------------------
#   TOTAL                : 18

# Set default directory to current directory if none provided
DIRECTORY="${1:-.}"

# Check if directory exists
if [ ! -d "$DIRECTORY" ]; then
    echo "Error: Directory '$DIRECTORY' does not exist"
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Please install jq first."
    echo "Installation:"
    echo "  macOS: brew install jq"
    echo "  Ubuntu/Debian: sudo apt-get install jq"
    echo "  CentOS/RHEL: sudo yum install jq"
    exit 1
fi

# Function to get unique resource types from a JSON file
get_resource_types() {
    local file="$1"
    jq -r '.entry[]?.resource.resourceType // empty' "$file" 2>/dev/null | sort | uniq
}

# Function to count entries for a specific resource type
count_resource_type() {
    local file="$1"
    local resource_type="$2"
    jq "[.entry[] | select(.resource.resourceType == \"$resource_type\")] | length" "$file" 2>/dev/null || echo "0"
}

# Find all JSON files in the directory
json_files=$(find "$DIRECTORY" -maxdepth 1 -name "*.json" -type f | sort)

if [ -z "$json_files" ]; then
    echo "No JSON files found in directory: $DIRECTORY"
    exit 0
fi

echo "Resource counts for JSON files in: $DIRECTORY"
echo "================================================"

# Process each JSON file
for file in $json_files; do
    filename=$(basename "$file")
    echo ""
    echo "File: $filename"
    echo "----------------------------------------"
    
    # Check if file is valid JSON and has .entry array
    if ! jq -e '.entry' "$file" >/dev/null 2>&1; then
        echo "  No .entry array found in this file (or invalid JSON)"
        continue
    fi
    
    # Get all unique resource types in this file
    resource_types=$(get_resource_types "$file")
    
    if [ -z "$resource_types" ]; then
        echo "  No resource types found in .entry array"
        continue
    fi
    
    # Count each resource type
    total_entries=0
    for resource_type in $resource_types; do
        count=$(count_resource_type "$file" "$resource_type")
        if [ "$count" -gt 0 ]; then
            printf "  %-20s: %d\n" "$resource_type" "$count"
            total_entries=$((total_entries + count))
        fi
    done
    
    # Show total if there are entries
    if [ $total_entries -gt 0 ]; then
        echo "  -------------------------"
        printf "  %-20s: %d\n" "TOTAL" "$total_entries"
    fi
done

echo ""
echo "Done." 