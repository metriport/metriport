consolidated_data_file_suffix = 'CONSOLIDATED_DATA.json'

def create_consolidated_key(cx_id: str, patient_id: str) -> str:
    return f'{cx_id}/{patient_id}/{cx_id}_{patient_id}_CONSOLIDATED_DATA.json'

def create_output_file_prefix(dwh: str, transform_name: str, cx_id: str, patient_id: str, job_id: str) -> str:
    return f"{dwh}/{transform_name}/{cx_id}/{patient_id}/{job_id}"

def strip_config_file_name(config_file: str) -> str:
    return config_file.replace('config_', '').replace('.ini', '').lower()
