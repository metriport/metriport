from .environment import Environment
from .file import strip_config_file_name

def format_database_name(cx_id: str, env: Environment):
    return f"{env.value.upper()}_METRICS_{cx_id.replace('-', '')}"

def format_table_name(file_name):
    return strip_config_file_name(file_name).replace('.', '_').lower()

def get_data_type(column_name, date_types, default_type="varchar"):
    if date_types:
        if column_name.endswith("date"):
            return "date"
        elif column_name.endswith("datetime") or column_name.endswith("time"):
            return "timestamp"
    return default_type
