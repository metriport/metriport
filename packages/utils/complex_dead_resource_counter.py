import os
import json
import sys

def find_dead_responses(directory):
    dead_responses = {}
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".json"):
                file_path = os.path.join(root, file)
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    for entry in data.get("entry", []):
                        resource = entry.get("resource")
                        if resource:
                            resource_type = resource.get("resourceType")
                            for field in ["vaccineCode", "code", "reasonCode"]:
                                no_phrases = ["no known", "no observation", "no data", "no information", "no results", "no medical", "no smoking status", "no social history", "no chronic problems"]
                                if field in resource and "text" in resource[field]:
                                    text_lower = resource[field]["text"].lower()
                                    text = None
                                    if any(phrase in text_lower for phrase in no_phrases):
                                        text = resource[field]["text"]
                                    if text:
                                        if text not in dead_responses:
                                            dead_responses[text] = {"count": 0, "resources": set()}
                                        dead_responses[text]["count"] += 1
                                        dead_responses[text]["resources"].add(resource_type)
    return dead_responses

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python script.py <directory>")
        sys.exit(1)
    directory = sys.argv[1]
    dead_resources_count = find_dead_responses(directory)
    for resource_type, count in dead_resources_count.items():
        print(f"{resource_type}: {count}")

    total_count = sum(response['count'] for response in dead_resources_count.values())
    print(f"Total count of resources with 'dead responses': {total_count}")
        
    
# No known medications: {'count': 31, 'resources': {'Medication'}}
# No known active problems: {'count': 23, 'resources': {'Condition'}}
# No observation recorded.: {'count': 55, 'resources': {'Observation'}}
# No known problems: {'count': 9, 'resources': {'Condition'}}
# No data available for this section: {'count': 358, 'resources': {'Immunization', 'Observation', 'Condition', 'Procedure'}}
# No Data Provided for This Section: {'count': 5, 'resources': {'Immunization', 'Observation', 'Condition'}}
# No information available.: {'count': 18, 'resources': {'Medication', 'Immunization', 'Observation', 'Procedure', 'Condition'}}
# No Known Medications: {'count': 3, 'resources': {'Medication'}}
# No Smoking Status Entered: {'count': 17, 'resources': {'Observation'}}
# No Known Immunizations: {'count': 1, 'resources': {'Immunization'}}
# No Medical Equipment Recorded: {'count': 2, 'resources': {'Procedure'}}
# No Results Recorded For Specified Dates: {'count': 2, 'resources': {'Observation'}}
# No Social History Recorded - Smoking Status Unknown: {'count': 2, 'resources': {'Observation'}}
# No Known Problems: {'count': 1, 'resources': {'Condition'}}
# No Information: {'count': 1, 'resources': {'Observation'}}
# No Chronic Problems(): {'count': 3, 'resources': {'Condition'}}
# No Chronic Problems: {'count': 2, 'resources': {'Condition'}}
# No Chronic Problems(Confirmed): {'count': 1, 'resources': {'Condition'}}
# Total count of resources with 'dead responses': 534