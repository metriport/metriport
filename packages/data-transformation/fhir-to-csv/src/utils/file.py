consolidated_data_file_suffix = 'CONSOLIDATED_DATA.json'

def create_consolidated_key(cx_id: str, patient_id: str) -> str:
    return f'{cx_id}/{patient_id}/{cx_id}_{patient_id}_{consolidated_data_file_suffix}'

def create_patient_output_prefix(base_prefix: str, patient_id: str) -> str:
    return f"{base_prefix}/pt={patient_id}"