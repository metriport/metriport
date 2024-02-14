#!/bin/bash

root_directory=$1

# Iterate over each subdirectory in the given root directory
for directory in "$root_directory"/*; do
  if [ -d "$directory" ]; then  # Check if it is a directory
    for file in "$directory"/*.json; do
      # Check if there is at least one Composition resource
      has_composition=$(jq '.entry[].resource | select(.resourceType == "Composition") | length > 0' "$file")
      
      if [[ "$has_composition" == "true" ]]; then
        # Count entries in sections with "Encounter" or "Encounter Details" in the title within Composition resources
        encounter_entries=$(jq '[.entry[].resource | select(.resourceType == "Composition").section[]? | select(.title? == "Encounter" or .title? == "Encounter Details") | .entry[]? | length] | add' "$file")
        
        # Check if there is a section with the title "Reason for Visit" within Composition resources
        reason_for_visit_exists=$(jq '[.entry[].resource | select(.resourceType == "Composition").section[]? | select(.title? == "Reason for Visit")] | length > 0' "$file")
        
        # If encounter_entries is null or not set, set it to 0
        if [ -z "$encounter_entries" ] || [ "$encounter_entries" == "null" ]; then
          encounter_entries=0
        fi
        
        # Convert reason_for_visit_exists to a boolean value
        if [[ "$reason_for_visit_exists" == "true" ]]; then
          reason_for_visit_flag=true
        else
          reason_for_visit_flag=false
        fi
        
        # If there are more than 1 entry in "Encounter" or "Encounter Details" sections and "Reason for Visit" exists
        if [ "$encounter_entries" -gt 1 ] && [ "$reason_for_visit_flag" == true ]; then
          echo "File: $file"
        fi
      fi
    done
  fi
done