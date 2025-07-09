import os
import json
import logging

from src.parseFhir import parseFhir
from src.utils.database import format_table_name
from src.utils.file import strip_config_file_name, create_parser_file_name

output_format = 'csv'

def get_resource_type_from_config(config_file):
    name = strip_config_file_name(config_file)
    if '_' in name:
        return name.split('_')[0]
    return name

def ensure_folder_exists(folder_path):
    os.makedirs(folder_path, exist_ok=True)

def parse(input_file: str, output_file_path: str, config_folder: str):   
    ensure_folder_exists(output_file_path)
    config_groups = {}
    for config_file in os.listdir(config_folder):
        if config_file.endswith('.ini'):
            resource_type = get_resource_type_from_config(config_file)
            if resource_type not in config_groups:
                config_groups[resource_type] = []
            config_groups[resource_type].append(config_file)

    for resource_type, config_files in config_groups.items():
        temp_filtered_input_file =f'{output_file_path}/temp_{resource_type.lower()}.ndjson'
        with open(input_file, 'r') as infile, open(temp_filtered_input_file, 'w') as outfile:
            for line_number, line in enumerate(infile):
                try:
                    resource = json.loads(line)
                    if resource['resource'].get('resourceType') == resource_type:
                        outfile.write(json.dumps(resource['resource']) + '\n')
                except json.JSONDecodeError:
                    logging.error(f"Error parsing line {line_number} from {input_file}")
                    continue

        for config_file in config_files:
            table_name = format_table_name(config_file)
            output_file_name = create_parser_file_name(table_name, output_format)
            parseFhir.parse(
                configPath=os.path.join(config_folder, config_file),
                inputPath=temp_filtered_input_file,
                inputFormat='ndjson',
                outputPath=f'{output_file_path}/{output_file_name}',
                outputFormat=output_format,
                writeMode='w'
            )
        
        os.remove(temp_filtered_input_file)

    return output_format
