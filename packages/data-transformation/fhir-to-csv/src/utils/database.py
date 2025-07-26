from .file import strip_config_file_name

# TODO ENG-722: Remove the 2 from the database name
def format_database_name(cx_id: str) -> str:
    return f"ANALYTICS2_{cx_id.replace('-', '_')}"

def format_table_name_from_config_file_name(config_file_name: str) -> str:
    return strip_config_file_name(config_file_name).replace('.', '_').lower()

def format_job_table_name(patient_id: str, job_id: str, table_name: str) -> str:
    return f"job_{job_id.replace('-', '_')}_pt_{patient_id.replace('-', '_')}_{table_name}"

def format_patient_status_table_name() -> str:
    return "patient_status"

def format_stage_name(cx_id: str, patient_id: str, job_id: str) -> str:
    return f"stage_{cx_id.replace('-', '_')}_pt_{patient_id.replace('-', '_')}_job_{job_id.replace('-', '_')}"

def get_data_type(column_name: str, date_types: bool, default_type: str = "varchar") -> str:
    if date_types:
        if column_name.endswith("date"):
            return "date"
        elif column_name.endswith("datetime") or column_name.endswith("time"):
            return "timestamp"
    return default_type
