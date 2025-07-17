from .file import strip_config_file_name

def format_database_name(cx_id: str) -> str:
    return f"ANALYTICS_{cx_id.replace('-', '_')}"

def format_table_name_from_config_file_name(config_file_name: str) -> str:
    return strip_config_file_name(config_file_name).replace('.', '_').lower()

def format_temp_table_name(table_name: str) -> str:
    return f"temp_{table_name}"

def format_stage_name(file_key: str) -> str:
    return f"{file_key.replace('/', '_').replace('-', '_').replace('.', '_')}_stage"

def get_data_type(column_name: str, date_types: bool, default_type: str = "varchar") -> str:
    if date_types:
        if column_name.endswith("date"):
            return "date"
        elif column_name.endswith("datetime") or column_name.endswith("time"):
            return "timestamp"
    return default_type
