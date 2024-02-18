import os
import json

def count_identical_conditions(directory):
    # Initialize a counter for files with identical conditions
    identical_conditions_count = 0

    # Walk through all files in the given directory
    for root, dirs, files in os.walk(directory):
        for file in files:
            # Construct the full file path
            file_path = os.path.join(root, file)
            try:
                # Open and load the JSON file
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    # Check if the file is a FHIR Bundle of type 'batch'
                    if data.get('resourceType') == 'Bundle' and data.get('type') == 'batch':
                        # Initialize a dictionary to count occurrences of condition texts
                        condition_texts = {}
                        # Iterate through each entry in the bundle
                        for entry in data.get('entry', []):
                            # Check if the entry is a Condition resource
                            if entry.get('resource', {}).get('resourceType') == 'Condition':
                                # Extract the condition text
                                condition_text = entry['resource'].get('code', {}).get('text', '')
                                # Increment the count for this condition text
                                condition_texts[condition_text] = condition_texts.get(condition_text, 0) + 1
                        # Check if any condition text appears more than once
                        if any(count > 1 for count in condition_texts.values()):
                            identical_conditions_count += 1
                            print(f"File with identical conditions: {file_path}")
            except Exception as e:
                print(f"Error processing file {file_path}: {e}")

    print(f"Total files with identical condition texts: {identical_conditions_count}")

# Example usage
directory = "/Users/jonahkaye/Desktop/metriport/metriport/packages/utils/runs/fhir-converter-e2e/2024-02-18T16:42:20.892Z/output"
count_identical_conditions(directory)