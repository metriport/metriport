#!/bin/bash

# Script to find JSON files using a custom jq filter.
# 
# This script processes JSON files and applies a custom jq filter to identify the matching ones.
#
# Usage: ./find_with_custom_filter.sh -d <directory> -f <jq_filter> [--maxdepth <depth>]
# 
# Examples:
#   ./find_with_custom_filter.sh -d . -f '[.entry[] | select(.resource.resourceType == "Encounter")] | length > 0'                               # Process current directory, maxdepth=1
#   ./find_with_custom_filter.sh -d . -f '[.entry[] | select(.resource.resourceType == "Encounter" and (.resource.subject | not))] | length > 0' # Process current directory, maxdepth=1
#   ./find_with_custom_filter.sh -d ./data -f '[.entry[] | select(.resource.resourceType == "Patient")] | length > 0'                            # Process ./data directory, maxdepth=1
#   ./find_with_custom_filter.sh -d /path/to/files -f '[.entry[] | select(.resource.resourceType == "Observation")] | length > 0' --maxdepth 3   # Process specific directory, maxdepth=3
#   ./find_with_custom_filter.sh --directory . --filter '[.entry[] | select(.resource.resourceType == "Encounter")] | length > 0' --maxdepth 5   # Process current directory, maxdepth=5
#
# Requirements:
#   - jq must be installed (https://stedolan.github.io/jq/)
#   - JSON files must have .entry array structure (FHIR Bundle format)
#
# Output format:
#   Files matching the filter:
#   - filename1.json
#   - filename2.json
#   
#   Total files found: 2

# Function to show usage
show_usage() {
    echo "Usage: $0 -d <directory> -f <jq_filter> [--maxdepth <depth>]"
    echo ""
    echo "Required parameters:"
    echo "  -d, --directory <path>    Directory to search for JSON files"
    echo "  -f, --filter <jq_filter>  JQ filter to apply to each JSON file"
    echo ""
    echo "Optional parameters:"
    echo "  --maxdepth <depth>        Maximum depth to search in subdirectories (default: 1)"
    echo ""
    echo "Examples:"
    echo "  $0 -d . -f '[.entry[] | select(.resource.resourceType == \"Encounter\")] | length > 0'"
    echo "  $0 -d ./data -f '[.entry[] | select(.resource.resourceType == \"Patient\")] | length > 0'"
    echo "  $0 -d /path/to/files -f '[.entry[] | select(.resource.resourceType == \"Observation\")] | length > 0' --maxdepth 3"
    echo "  $0 --directory . --filter '[.entry[] | select(.resource.resourceType == \"Encounter\")] | length > 0' --maxdepth 5"
    exit 1
}

# Parse command line arguments
DIRECTORY=""
JQ_FILTER=""
MAXDEPTH="1"

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--directory)
            DIRECTORY="$2"
            shift 2
            ;;
        -f|--filter)
            JQ_FILTER="$2"
            shift 2
            ;;
        --maxdepth)
            MAXDEPTH="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            ;;
    esac
done

# Check if required parameters are provided
if [ -z "$DIRECTORY" ] || [ -z "$JQ_FILTER" ]; then
    echo "Error: Both directory (-d) and filter (-f) are required"
    show_usage
fi

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

# Function to check if a file matches the custom filter
check_file_with_filter() {
    local file="$1"
    local filter="$2"
    
    # Apply the custom jq filter to the file
    local result=$(jq -e "$filter" "$file" 2>/dev/null)
    
    if [ "$result" = "true" ]; then
        return 0  # File matches the filter
    fi
    
    return 1  # File doesn't match the filter
}

# Find all JSON files in the directory and subdirectories up to maxdepth
json_files=$(find "$DIRECTORY" -maxdepth "$MAXDEPTH" -name "*.json" -type f | sort)

if [ -z "$json_files" ]; then
    echo "No JSON files found in directory: $DIRECTORY"
    exit 0
fi

echo "Searching for JSON files matching the custom filter..."
echo "Filter: $JQ_FILTER"
echo "Directory: $DIRECTORY"
echo "Max depth: $MAXDEPTH"
echo "================================================"

# Array to store files that match the filter
matching_files=()

# Process each JSON file
for file in $json_files; do
    # Get relative path from the search directory for better identification
    if [ "$DIRECTORY" = "." ]; then
        filename="$file"
    else
        filename="${file#$DIRECTORY/}"
    fi
    
    # Check if file is valid JSON and has .entry array
    if ! jq -e '.entry' "$file" >/dev/null 2>&1; then
        continue
    fi
    
    # Check if file matches our custom filter
    if check_file_with_filter "$file" "$JQ_FILTER"; then
        matching_files+=("$filename")
    fi
done

# Output results
echo ""
if [ ${#matching_files[@]} -eq 0 ]; then
    echo "No files found matching the filter."
else
    echo "Files matching the filter:"
    for filename in "${matching_files[@]}"; do
        echo "  - $filename"
    done
    
    echo ""
    echo "Total files found: ${#matching_files[@]}"
fi

echo ""
echo "Done." 