from .file import strip_config_file_name

def format_database_name(cx_id: str) -> str:
    return f"ANALYTICS_{cx_id.replace('-', '_')}"

def format_table_name_from_config_file_name(config_file_name: str) -> str:
    return strip_config_file_name(config_file_name).replace('.', '_').lower()

def format_job_table_name(patient_id: str, job_id: str, table_name: str) -> str:
    return f"job_{job_id.replace('-', '_')}_pt_{patient_id.replace('-', '_')}_{table_name}"

# e.g.: SNOWFLAKE_FHIR_TO_CSV_585E6A0B_2B22_46A7_9D76_4E7840EB0276_JOBID__TMP_OUTPUT_585E6A0B_2B22_46A7_9D76_4E7840EB0276_0196A0FC_529C_72F3_96C9_203BB47FEA9E_MEDICATIONDISPENSE_CSV_STAGE
def format_stage_name(file_key: str) -> str:
    return f"{file_key.replace('/', '_').replace('-', '_').replace('.', '_')}_stage"

def get_data_type(column_name: str, date_types: bool, default_type: str = "varchar") -> str:
    if date_types:
        if column_name.endswith("date"):
            return "date"
        elif column_name.endswith("datetime") or column_name.endswith("time"):
            return "timestamp"
    return default_type
