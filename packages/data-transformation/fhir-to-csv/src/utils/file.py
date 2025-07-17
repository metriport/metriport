consolidated_data_file_suffix = 'CONSOLIDATED_DATA.json'

def create_consolidated_key(cx_id: str, patient_id: str) -> str:
    return f'{cx_id}/{patient_id}/{cx_id}_{patient_id}_CONSOLIDATED_DATA.json'

def strip_config_file_name(config_file):
    return config_file.replace("config_", "").replace(".ini", "")
