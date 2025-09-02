consolidated_data_file_suffix = 'CONSOLIDATED_DATA.json'

def create_consolidated_key(cx_id: str, patient_id: str) -> str:
    return f'{cx_id}/{patient_id}/{cx_id}_{patient_id}_{consolidated_data_file_suffix}'

def create_output_file_prefix(dwh: str, transform_name: str, cx_id: str, patient_id: str, job_id: str) -> str:
    return f"{dwh}/{transform_name}/cx={cx_id}/f2c={job_id}/pt={patient_id}"
