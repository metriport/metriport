import os
from datetime import datetime
from .environment import Environment
from .dwh import DWH

consolidated_data_file_suffix = 'CONSOLIDATED_DATA.json'
phi_prefix = '../../../../phi/runs'
output_file_path_prefix = 'fhir-to-csv'

def create_dev_prefix(cx_id: str) -> str:
    return f'{phi_prefix}/{cx_id}/datetime={datetime.now().strftime("%Y-%m-%d_%H-%M-%S")}/'

def create_path_prefix(cx_id: str, env: Environment) -> str:
    return create_dev_prefix(cx_id) if env == Environment.DEV else ''

def create_bundle_path_and_file_name(cx_id: str, env: Environment, s3_bundle_file_key: str) -> tuple[str, str]:
    *s3_key_path_parts, s3_key_file_name = s3_bundle_file_key.split("/")
    local_path_env_prefix = create_path_prefix(cx_id, env)
    local_path_bundles = f'{local_path_env_prefix}bundles/{"/".join(s3_key_path_parts)}'
    if not os.path.exists(local_path_bundles):
        os.makedirs(local_path_bundles)
    return local_path_bundles, s3_key_file_name

def create_output_path(cx_id: str, env: Environment) -> str:
    local_path_env_prefix = create_path_prefix(cx_id, env)
    return f'{local_path_env_prefix}{output_file_path_prefix}/{cx_id}'

def create_upload_path(dwh: DWH, cx_id: str) -> str:
    return f'{dwh}/{output_file_path_prefix}/{cx_id}'

def create_upload_path_with_table_name(dwh: DWH, cx_id: str, table_name: str) -> str:
    return f'{create_upload_path(dwh, cx_id)}/{table_name}'

def create_parser_file_name(table_name: str, output_format: str) -> str:
    return f'{table_name}.{output_format}'

def parse_parser_file_name(file_name: str, output_format: str) -> str:
    return file_name.replace(f".{output_format}", "")

def strip_config_file_name(config_file):
    return config_file.replace("config_", "").replace(".ini", "")
