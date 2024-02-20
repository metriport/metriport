import os
import json
import sys

def count_dead_resources(directory):
    resource_counts = {}
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".json"):
                file_path = os.path.join(root, file)
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    for entry in data.get("entry", []):
                        resource = entry.get("resource")
                        
                        # Check if resource only has 'resourceType' and 'id', or also includes 'meta', or includes 'meta' and 'identifier'
                        if resource and (("meta" in resource and "id" in resource and len(resource) == 3) or 
                                         ("id" in resource and len(resource) == 2) or
                                         ("meta" in resource and "identifier" in resource and "id" in resource and len(resource) == 4)):
                            resource_type = resource.get("resourceType")
                            if resource_type:
                                resource_counts[resource_type] += 1
                        
                        if resource and ("resourceType" in resource and "id" in resource and len(resource) == 4):
                            # Check for any additional field that contains a subreference field
                            has_subreference = any(isinstance(value, dict) for value in resource.values() if value != resource.get("meta"))
                            if has_subreference:
                                resource_type = resource.get("resourceType")
                                if resource_type:
                                    resource_counts[resource_type] = resource_counts.get(resource_type, 0) + 1
    return resource_counts

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python script.py <directory>")
        sys.exit(1)
    directory = sys.argv[1]
    dead_resources_count = count_dead_resources(directory)
    for resource_type, count in dead_resources_count.items():
        print(f"{resource_type}: {count}")


# Resolved with dead resource filter
# Location: 8983
# Practitioner: 22630
# Organization: 1491
# Medication: 19

# More deads which are basically dangling subjects afaik 
# AllergyIntolerance: 98
# Condition: 61
# Observation: 93
# Location: 19
# FamilyMemberHistory: 4
# Procedure: 3
# RelatedPerson: 4
# 250 dangling reference resources