#!/bin/bash

# Script to find JSON files using a custom jq filter.
# 
# This script processes JSON files and applies a custom jq filter to identify the matching ones.
#
# Usage: ./find_with_custom_filter.sh (-d <directory> | -f <file>) -j <jq_filter> [--maxdepth <depth>]
# 
# If run with -f it will only indicate whether the file matches the filter (found) or not (not found).
# 
# Examples:
#   ./find_with_custom_filter.sh -d . -j '[.entry[] | select(.resource.resourceType == "Encounter")] | length > 0'                               # Process current directory, maxdepth=1
#   ./find_with_custom_filter.sh -d . -j '[.entry[] | select(.resource.resourceType == "Encounter" and (.resource.subject | not))] | length > 0' # Process current directory, maxdepth=1
#   ./find_with_custom_filter.sh -d ./data -j '[.entry[] | select(.resource.resourceType == "Patient")] | length > 0'                            # Process ./data directory, maxdepth=1
#   ./find_with_custom_filter.sh -d /path/to/files -j '[.entry[] | select(.resource.resourceType == "Observation")] | length > 0' --maxdepth 3   # Process specific directory, maxdepth=3
#   ./find_with_custom_filter.sh -f /path/to/single/file.json -j '[.entry[] | select(.resource.resourceType == "Encounter")] | length > 0'        # Process single file
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
    echo "Usage: $0 (-d <directory> | -f <file>) -j <jq_filter> [--maxdepth <depth>]"
    echo ""
    echo "Required parameters (exactly one of the following):"
    echo "  -d, --directory <path>    Directory to search for JSON files"
    echo "  -f, --file <path>         Single JSON file to process"
    echo ""
    echo "Required parameters:"
    echo "  -j, --filter <jq_filter>  JQ filter to apply to each JSON file"
    echo ""
    echo "Optional parameters:"
    echo "  --maxdepth <depth>        Maximum depth to search in subdirectories (default: 1, only applies with -d)"
    echo ""
    echo "Examples:"
    echo "  $0 -d . -j '[.entry[] | select(.resource.resourceType == \"Encounter\")] | length > 0'"
    echo "  $0 -d ./data -j '[.entry[] | select(.resource.resourceType == \"Patient\")] | length > 0'"
    echo "  $0 -f /path/to/file.json -j '[.entry[] | select(.resource.resourceType == \"Observation\")] | length > 0'"
    echo "  $0 -d /path/to/files -j '[.entry[] | select(.resource.resourceType == \"Observation\")] | length > 0' --maxdepth 3"
    echo "  $0 --directory . --filter '[.entry[] | select(.resource.resourceType == \"Encounter\")] | length > 0' --maxdepth 5"
    exit 1
}

# Parse command line arguments
DIRECTORY=""
SINGLE_FILE=""
JQ_FILTER=""
MAXDEPTH="1"

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--directory)
            DIRECTORY="$2"
            shift 2
            ;;
        -f|--file)
            SINGLE_FILE="$2"
            shift 2
            ;;
        -j|--filter)
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

# Check if exactly one of directory or file is provided
if [ -n "$DIRECTORY" ] && [ -n "$SINGLE_FILE" ]; then
    echo "Error: Cannot specify both directory (-d) and file (-f). Please choose one."
    show_usage
fi

if [ -z "$DIRECTORY" ] && [ -z "$SINGLE_FILE" ]; then
    echo "Error: Must specify either directory (-d) or file (-f). Please choose one."
    show_usage
fi

# Check if jq filter is provided
if [ -z "$JQ_FILTER" ]; then
    echo "Error: JQ filter (-j) is required"
    show_usage
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
    local result
    result=$(jq -e "$filter" "$file" 2>/dev/null)
    
    if [ "$result" = "true" ]; then
        return 0  # File matches the filter
    fi
    
    return 1  # File doesn't match the filter
}

# Process based on whether directory or single file was specified
if [ -n "$DIRECTORY" ]; then
    # Directory mode
    if [ ! -d "$DIRECTORY" ]; then
        echo "Error: Directory '$DIRECTORY' does not exist"
        echo "Current working directory: $(pwd)"
        echo "Please check the directory path and try again."
        exit 1
    fi
    
    # Find all JSON files in the directory and subdirectories up to maxdepth
    json_files=$(find "$DIRECTORY" -maxdepth "$MAXDEPTH" -name "*.json" -type f | sort)
    
    if [ -z "$json_files" ]; then
        echo "No JSON files found in directory: $DIRECTORY"
        exit 0
    fi
    
    # Count number of files found
    file_count=$(echo "$json_files" | wc -l)
    
    echo "Searching for JSON files matching the custom filter..."
    echo "Filter: $JQ_FILTER"
    echo "Directory: $DIRECTORY"
    echo "Max depth: $MAXDEPTH"
    echo "Files found: $file_count"
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
    
else
    # Single file mode
    if [ ! -f "$SINGLE_FILE" ]; then
        echo "Error: File '$SINGLE_FILE' does not exist"
        echo "Current working directory: $(pwd)"
        if [[ "$SINGLE_FILE" != /* ]]; then
            echo "Note: Using relative path. File should be relative to current directory."
        fi
        echo "Please check the file path and try again."
        exit 1
    fi
    
    if [[ "$SINGLE_FILE" != *.json ]]; then
        echo "Error: File '$SINGLE_FILE' is not a JSON file"
        exit 1
    fi
    
    echo "Processing single JSON file with custom filter..."
    echo "Filter: $JQ_FILTER"
    echo "File: $SINGLE_FILE"
    echo "================================================"
    
    # Check if file is valid JSON and has .entry array
    if ! jq -e '.entry' "$SINGLE_FILE" >/dev/null 2>&1; then
        echo "Error: File '$SINGLE_FILE' is not a valid FHIR Bundle JSON file (missing .entry array)"
        exit 1
    fi
    
    # Check if file matches our custom filter
    if check_file_with_filter "$SINGLE_FILE" "$JQ_FILTER"; then
        matching_files=("$SINGLE_FILE")
    else
        matching_files=()
    fi
fi

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