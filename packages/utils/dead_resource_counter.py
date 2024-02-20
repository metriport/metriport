import os
import json
import sys

def count_dead_resources(directory):
    resource_counts = {}
    oid_counts = {}
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".json"):
                file_path = os.path.join(root, file)
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    if not isinstance(data, dict):
                        print(f"Skipping file {file_path} as it contains a JSON array at the top level.")
                        continue
                    for entry in data.get("entry", []):
                        resource = entry.get("resource")
                        
                        # Check if resource only has 'resourceType' and 'id', or also includes 'meta', or includes 'meta' and 'identifier'
                        if resource and (("meta" in resource and "id" in resource and len(resource) == 3) or 
                                         ("id" in resource and len(resource) == 2) or
                                         ("meta" in resource and "identifier" in resource and "id" in resource and len(resource) == 4)):
                            resource_type = resource.get("resourceType")
                            if (resource_type == "Practitioner"):
                                identifier_system = resource.get("identifier")[0].get("system") if resource.get("identifier") else "No identifier system"
                                oid_counts[identifier_system] = oid_counts.get(identifier_system, 0) + 1         
                            if resource_type:
                                resource_counts[resource_type] = resource_counts.get(resource_type, 0) + 1
                        
                        if resource and ("resourceType" in resource and "id" in resource and len(resource) == 4):
                            for key, value in resource.items():
                                if isinstance(value, dict) and key != "meta":
                                    resource_type = resource.get("resourceType")
                                    subreference_field = f"{resource_type}_{key}"
                                    resource_counts[subreference_field] = resource_counts.get(subreference_field, 0) + 1
    return resource_counts, oid_counts

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python script.py <directory>")
        sys.exit(1)
    directory = sys.argv[1]
    dead_resources_count, oid_counts = count_dead_resources(directory)
    # for resource_type, count in dead_resources_count.items():
    #     print(f"{resource_type}: {count}")
    for oid_name, count in sorted(oid_counts.items(), key=lambda item: item[1], reverse=True):
        print(f"{oid_name}: {count}")


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