import os
import json
import sys

def count_conditions_categories(directory):
    condition_category_count = 0
    conditions_count = 0
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
                        if resource:
                            resource_type = resource.get("resourceType")
                            if resource_type == "Condition":
                                conditions_count += 1
                                if "category" in resource:
                                    condition_category_count += 1
                                    print(file_path, resource.get("id"))
    return condition_category_count, conditions_count

def count_dead_resources(directory):
    resource_counts = {}
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
                        if resource and ("id" in resource and len(resource) <= 3 and "code" not in resource and "name" not in resource):
                            resource_type = resource.get("resourceType")
                            if resource_type:
                                resource_counts[resource_type] = resource_counts.get(resource_type, 0) + 1
                            if resource_type == "DiagnosticReport":
                                print(file_path, resource.get("id"))

                        if resource and ("resourceType" in resource and "id" in resource and len(resource) <= 3):
                            for key, value in resource.items():
                                if isinstance(value, dict) and key != "meta":
                                    resource_type = resource.get("resourceType")
                                    if resource_type == "Location":
                                        print(file_path, resource.get("id"), key)
                                    subreference_field = f"{resource_type}_{key}"
                                    resource_counts[subreference_field] = resource_counts.get(subreference_field, 0) + 1
    return resource_counts

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python script.py <directory>")
        sys.exit(1)
    directory = sys.argv[1]
    dead_resources_count = count_dead_resources(directory)
    for resource_type, count in dead_resources_count.items():
        print(f"{resource_type}: {count}")