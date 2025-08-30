#!/bin/bash

# Script to extract resource IDs from a FHIR bundle JSON file using a custom jq filter.
# 
# This script processes a single FHIR bundle JSON file and extracts resource IDs
# that match specific criteria defined by a JQ filter.
#
# Usage: ./extract_resource_ids.sh -f <file> -j <jq_filter> [-r <resource_type>] [-o <output_format>]
# 
# Examples:
#   ./extract_resource_ids.sh -f bundle.json -j '[.entry[] | select(.resource.resourceType == "Condition" and (.resource.subject | not))] | length > 0' -r Condition -o list
#   ./extract_resource_ids.sh -f bundle.json -j '[.entry[] | select(.resource.resourceType == "Encounter" and .resource.status == "finished")] | length > 0' -r Encounter -o csv
#   ./extract_resource_ids.sh -f bundle.json -j '[.entry[] | select(.resource.resourceType == "Patient" and .resource.gender == "female")] | length > 0' -r Patient -o json
#
# Parameters:
#   -f, --file        Path to the FHIR bundle JSON file (required)
#   -j, --filter      JQ filter to identify matching resources (required)
#   -r, --resource    Resource type to extract IDs from (optional, defaults to all)
#   -o, --output      Output format: list, csv, json (optional, defaults to list)
#
# Output formats:
#   list: One ID per line
#   csv: Comma-separated values with headers
#   json: JSON array of IDs

set -euo pipefail

# Default values
output_format="list"
resource_type=""

# Function to display usage information
show_usage() {
    cat << EOF
Usage: $0 -f <file> -j <jq_filter> [-r <resource_type>] [-o <output_format>]

Extract resource IDs from a FHIR bundle JSON file based on JQ filter criteria.

Required parameters:
  -f, --file        Path to the FHIR bundle JSON file
  -j, --filter      JQ filter to identify matching resources

Optional parameters:
  -r, --resource    Resource type to extract IDs from (defaults to all)
  -o, --output      Output format: list, csv, json (defaults to list)

Examples:
  $0 -f bundle.json -j '[.entry[] | select(.resource.resourceType == "Condition" and (.resource.subject | not))] | length > 0' -r Condition
  $0 -f bundle.json -j '[.entry[] | select(.resource.resourceType == "Encounter")] | length > 0' -o csv

EOF
}

# Function to display error message and exit
error_exit() {
    echo "Error: $1" >&2
    show_usage
    exit 1
}

# Function to validate JQ filter
validate_jq_filter() {
    local filter="$1"
    
    # Check if filter contains basic FHIR bundle structure
    if ! echo "$filter" | grep -q "\.entry"; then
        error_exit "JQ filter should reference '.entry' to process FHIR bundle entries"
    fi
    
    # Check if filter contains resource selection
    if ! echo "$filter" | grep -q "select"; then
        error_exit "JQ filter should use 'select()' to filter resources"
    fi
}

# Function to extract IDs based on filter and format
extract_ids() {
    local file="$1"
    local filter="$2"
    local resource_type="$3"
    local output_format="$4"
    
    # Build the JQ query based on parameters
    local jq_query=""
    
    if [[ -n "$resource_type" ]]; then
        # Filter by specific resource type
        jq_query=".entry[] | select(.resource.resourceType == \"$resource_type\") | .resource.id"
    else
        # Extract all resource IDs
        jq_query=".entry[] | .resource.id"
    fi
    
    # Apply the custom filter if provided
    if [[ -n "$filter" ]]; then
        # First check if the filter matches any resources
        local has_matches
        has_matches=$(jq -r "$filter" "$file" 2>/dev/null || echo "false")
        
        if [[ "$has_matches" == "false" ]]; then
            echo "No resources match the specified filter criteria."
            return 0
        fi
        
        # If filter matches, extract IDs with resource type constraint
        if [[ -n "$resource_type" ]]; then
            jq_query=".entry[] | select(.resource.resourceType == \"$resource_type\" and ($filter | .[0] | .resource.resourceType == \"$resource_type\")) | .resource.id"
        else
            jq_query=".entry[] | select($filter | .[0] | .resource.resourceType == .resource.resourceType) | .resource.id"
        fi
    fi
    
    # Execute the query and format output
    case "$output_format" in
        "list")
            jq -r "$jq_query" "$file" 2>/dev/null | grep -v "^null$" | sort -u
            ;;
        "csv")
            if [[ -n "$resource_type" ]]; then
                echo "resource_type,id"
                jq -r "$jq_query" "$file" 2>/dev/null | grep -v "^null$" | sort -u | sed "s/^/$resource_type,/"
            else
                echo "resource_type,id"
                jq -r ".entry[] | [.resource.resourceType, .resource.id] | @csv" "$file" 2>/dev/null | grep -v "null" | sort -u
            fi
            ;;
        "json")
            if [[ -n "$resource_type" ]]; then
                jq -r "[$jq_query | select(. != null)]" "$file" 2>/dev/null
            else
                jq -r "[.entry[] | .resource.id | select(. != null)]" "$file" 2>/dev/null
            fi
            ;;
        *)
            error_exit "Invalid output format: $output_format. Use: list, csv, or json"
            ;;
    esac
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--file)
            file_path="$2"
            shift 2
            ;;
        -j|--filter)
            jq_filter="$2"
            shift 2
            ;;
        -r|--resource)
            resource_type="$2"
            shift 2
            ;;
        -o|--output)
            output_format="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            error_exit "Unknown option: $1"
            ;;
    esac
done

# Check required parameters
if [[ -z "${file_path:-}" ]]; then
    error_exit "File path (-f) is required"
fi

if [[ -z "${jq_filter:-}" ]]; then
    error_exit "JQ filter (-j) is required"
fi

# Validate file exists and is readable
if [[ ! -f "$file_path" ]]; then
    error_exit "File not found: $file_path"
fi

if [[ ! -r "$file_path" ]]; then
    error_exit "File not readable: $file_path"
fi

# Validate output format
case "$output_format" in
    list|csv|json)
        ;;
    *)
        error_exit "Invalid output format: $output_format. Use: list, csv, or json"
        ;;
esac

# Validate JQ filter
validate_jq_filter "$jq_filter"

# Check if jq is available
if ! command -v jq &> /dev/null; then
    error_exit "jq is required but not installed. Please install jq to continue."
fi

# Check if file is valid JSON
if ! jq empty "$file_path" 2>/dev/null; then
    error_exit "File is not valid JSON: $file_path"
fi

# Check if file has FHIR bundle structure
if ! jq -e '.entry' "$file_path" &>/dev/null; then
    error_exit "File does not appear to be a FHIR bundle (missing .entry array): $file_path"
fi

echo "Extracting resource IDs from FHIR bundle..."
echo "File: $file_path"
echo "Filter: $jq_filter"
if [[ -n "$resource_type" ]]; then
    echo "Resource type: $resource_type"
fi
echo "Output format: $output_format"
echo "================================================"

# Extract and display IDs
extract_ids "$file_path" "$jq_filter" "$resource_type" "$output_format"

echo "Done." 