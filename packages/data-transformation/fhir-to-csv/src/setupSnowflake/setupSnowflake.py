import os
import configparser
import json
from src.utils.database import (
    format_table_name_from_config_file_name,
    format_job_table_name,
    format_patient_status_table_name,
    format_stage_name,
    get_data_type,
)

# Define base paths
config_folder = 'src/parseFhir/configurations/'

snowflake_integration = os.getenv("SNOWFLAKE_INTEGRATION")
if snowflake_integration is None:
    raise ValueError("SNOWFLAKE_INTEGRATION is not set")

def get_snowflake_credentials(creds: dict) -> dict[str, str]:
    snowflake_account = creds.get("account")
    snowflake_user = creds.get("user")
    snowflake_password = creds.get("password")
    snowflake_role = os.getenv("SNOWFLAKE_ROLE")
    snowflake_warehouse = os.getenv("SNOWFLAKE_WAREHOUSE")
    if (
        snowflake_account is None or 
        snowflake_user is None or 
        snowflake_password is None or 
        snowflake_warehouse is None or 
        snowflake_role is None
    ):
        raise ValueError("Snowflake credentials are not set")
    return {
        "account": snowflake_account,
        "user": snowflake_user,
        "password": snowflake_password,
        "warehouse": snowflake_warehouse,
        "role": snowflake_role
    }

def generate_table_names_and_create_table_statements(patient_id: str, job_id: str, date_types=False) -> list[tuple[str, str, str, str, str]]:
    table_names_and_create_table_statements = []
    print(f'Running generate_table_names_and_create_table_statements for pt "{patient_id}", job "{job_id}"')
    for file in os.listdir(config_folder):
        if not file.endswith(".ini"):
            continue
        print(f'Loading config "{file}"')
        resource_table_name = format_table_name_from_config_file_name(file)
        job_table_name = format_job_table_name(patient_id, job_id, resource_table_name)
        config = configparser.ConfigParser()
        config.read(os.path.join(config_folder, file))
        if 'Struct' not in config:
            continue
        columns = config['Struct']
        columns_list = ",".join([f"{col}" for col in columns])
        columns_definitions = ",".join([f"{col} {get_data_type(col, date_types)}" for col in columns])

        create_job_table_statement = f"CREATE TABLE IF NOT EXISTS {job_table_name} (\n"
        create_job_table_statement += columns_definitions
        create_job_table_statement += "\n)\n"

        create_resource_table_statement = f"CREATE HYBRID TABLE IF NOT EXISTS {resource_table_name} (\n"
        create_resource_table_statement += "PK NUMBER PRIMARY KEY AUTOINCREMENT,\n"
        create_resource_table_statement += f"{columns_definitions}\n)"

        table_names_and_create_table_statements.append((
            resource_table_name,
            columns_list,
            create_resource_table_statement,
            job_table_name,
            create_job_table_statement
        ))
    return table_names_and_create_table_statements

def create_job_tables(
    snowflake_conn,
    cx_id: str,
    patient_id: str,
    job_id: str,
    table_defs: list[tuple[str, str, str, str, str]],
):
    print(f'Running create_job_tables for cx "{cx_id}", pt "{patient_id}", job "{job_id}"')
    for _, _, _, job_table_name, create_job_table_statement in table_defs:
        snowflake_conn.cursor().execute(f"DROP TABLE IF EXISTS {job_table_name}")
        snowflake_conn.cursor().execute(create_job_table_statement)

def copy_into_resource_table(
    snowflake_conn,
    cx_id: str,
    patient_id: str,
    job_id: str,
    table_defs: list[tuple[str, str, str, str, str]],
    rebuild_patient: bool = False,
):
    print(f'Running copy_into_resource_table for cx "{cx_id}", pt "{patient_id}", job "{job_id}"')
    for table_name, columns_list, create_resource_table_statement, job_table_name, _ in table_defs:
        print(f'...creating if not exists {table_name}')
        snowflake_conn.cursor().execute(create_resource_table_statement)
        if rebuild_patient:
            print(f'...replacing entries on resource table "{table_name}" from job table "{job_table_name}"')
            snowflake_conn.cursor().execute(f"DELETE FROM {table_name} WHERE filename like '%{patient_id}%'")
        else:
            print(f'...appending to resource table "{table_name}" from job table "{job_table_name}"')
        snowflake_conn.cursor().execute(f"INSERT INTO {table_name} ({columns_list}) SELECT * FROM {job_table_name}")
        snowflake_conn.cursor().execute(f"DROP TABLE IF EXISTS {job_table_name}")

def create_stage(snowflake_conn, cx_id: str, patient_id: str, job_id: str, s3_bucket: str, output_file_prefix: str):
    print(f'Running create_stage for cx "{cx_id}", pt "{patient_id}", job "{job_id}"')
    stage_name = format_stage_name(cx_id, patient_id, job_id)
    print(f'...stage_name "{stage_name}"')
    file_path = output_file_prefix
    url = f"s3://{s3_bucket}/{file_path}/"
    print(f'...S3 url "{url}"')
    snowflake_conn.cursor().execute(f"DROP STAGE IF EXISTS {stage_name}")
    snowflake_conn.cursor().execute(f"""
        CREATE STAGE {stage_name}
        STORAGE_INTEGRATION = {snowflake_integration}
        URL = '{url}';
        """)

def drop_stage(snowflake_conn, cx_id: str, patient_id: str, job_id: str):
    print(f'Running drop_stage for cx "{cx_id}", pt "{patient_id}", job "{job_id}"')
    stage_name = format_stage_name(cx_id, patient_id, job_id)
    print(f'...stage_name "{stage_name}"')
    snowflake_conn.cursor().execute(f"DROP STAGE IF EXISTS {stage_name}")

def copy_into_job_table(snowflake_conn, cx_id: str, patient_id: str, job_id: str, s3_bucket: str, file_key: str, table_name: str):
    print(f'Running copy_into_job_table for cx "{cx_id}", file "{file_key}", table "{table_name}"')
    stage_name = format_stage_name(cx_id, patient_id, job_id)
    file_parts = file_key.split('/')
    file_name = file_parts[-1]
    file_path = '/'.join(file_parts[:-1])
    url = f"s3://{s3_bucket}/{file_path}/"
    print(f'...S3 url "{url}"')
    job_table_name = format_job_table_name(patient_id, job_id, table_name)
    snowflake_conn.cursor().execute(f"""
        COPY INTO {job_table_name} 
        FROM @{stage_name}
        FILE_FORMAT = (TYPE = CSV FIELD_DELIMITER = ',', ESCAPE = '\\\\', FIELD_OPTIONALLY_ENCLOSED_BY = '\"')
        FILES = ('{file_name}')
        """)

def set_patient_status(snowflake_conn, cx_id: str, patient_id: str, status: str):
    print(f'Running set_patient_status for cx "{cx_id}", pt "{patient_id}", status "{status}"')
    table_name = format_patient_status_table_name()
    snowflake_conn.cursor().execute(f"CREATE HYBRID TABLE IF NOT EXISTS {table_name} (ID VARCHAR(255) PRIMARY KEY, STATUS VARCHAR(255))")
    snowflake_conn.cursor().execute(f"DELETE FROM {table_name} WHERE ID = '{patient_id}'")
    snowflake_conn.cursor().execute(f"INSERT INTO {table_name} (ID, STATUS) VALUES ('{patient_id}', '{status}')")

