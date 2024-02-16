#!/bin/bash

root_directory=$1

# Initialize counters
total_files_with_other_resource=0
files_with_other_resource_and_multiple_encounters=0
files_with_other_resource_and_zero_encounters=0

# Iterate over each subdirectory in the given root directory
for directory in "$root_directory"/*; do
  if [ -d "$directory" ]; then  # Check if it is a directory
    for file in "$directory"/*.json; do
      
      # Check if there is at least one Composition resource
      has_composition=$(jq '.entry[].resource | select(.resourceType == "Composition") | length > 0' "$file")
      
      if [[ "$has_composition" == "true" ]]; then
        # Count entries in sections with "Encounter" or "Encounter Details" in the title within Composition resources
        encounter_entries=$(jq '[.entry[].resource | select(.resourceType == "Composition").section[]? | select(.title? == "Encounter" or .title? == "Encounter Details" or .title? == "Encounters") | .entry[]? | length] | add' "$file")
        
        # Check if there is a section with the title "XYZ" within Composition resources
        other_resource_exists=$(jq '[.entry[].resource | select(.resourceType == "Composition").section[]? | select(.title? == "Plan of Treatment")] | length > 0' "$file")
        
        # If encounter_entries is null or not set, set it to 0
        if [ -z "$encounter_entries" ] || [ "$encounter_entries" == "null" ]; then
          encounter_entries=0
        fi
        
        # Convert other_resource_exists to a boolean value
        if [[ "$other_resource_exists" == "true" ]]; then
          other_resource_flag=true
          let total_files_with_other_resource+=1  # Increment total files counter
        else
          other_resource_flag=false
        fi
        
        # If there are more than 1 entry in "Encounter" or "Encounter Details" sections and "Reason for Visit" exists
        if [ "$encounter_entries" -gt 1 ] && [ "$other_resource_flag" == true ]; then
          let files_with_other_resource_and_multiple_encounters+=1
        fi
        
        # If "Reason for Visit" exists and there are 0 "Encounter" or "Encounter Details" entries
        if [ "$encounter_entries" -eq 0 ] && [ "$other_resource_flag" == true ]; then
          let files_with_other_resource_and_zero_encounters+=1
        fi
      fi
    done
  fi
done

# Print the final counts
echo "Total files with XYZ Resource: $total_files_with_other_resource"
echo "Files with XYZ Resource and multiple Encounter entries: $files_with_other_resource_and_multiple_encounters"
echo "Files with XYZ Resource and 0 Encounter entries: $files_with_other_resource_and_zero_encounters"