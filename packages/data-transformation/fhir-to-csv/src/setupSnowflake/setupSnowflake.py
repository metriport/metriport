import snowflake.connector
import os
import configparser
import logging
import json
from src.utils.database import (
    format_database_name,
    format_table_name_from_config_file_name,
    format_job_table_name,
    format_stage_name,
    get_data_type,
)

# Define base paths
config_folder = 'src/parseFhir/configurations/'

snowflake_integration = os.getenv("SNOWFLAKE_INTEGRATION")
if snowflake_integration is None:
    raise ValueError("SNOWFLAKE_INTEGRATION is not set")

def get_snowflake_credentials() -> dict[str, str]:
    snowflake_creds = os.getenv("SNOWFLAKE_CREDS")
    if not snowflake_creds:
        raise ValueError("SNOWFLAKE_CREDS is not set")
    snowflake_creds = json.loads(snowflake_creds)
    snowflake_account = snowflake_creds.get("account")
    snowflake_user = snowflake_creds.get("user")
    snowflake_password = snowflake_creds.get("password")
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

def generate_table_names_and_create_table_statements(job_id: str, date_types=False) -> list[tuple[str, str, str]]:
    table_names_and_create_job_table_statements = []
    for file in os.listdir(config_folder):
        if not file.endswith(".ini"):
            continue
        table_name = format_table_name_from_config_file_name(file)
        job_table_name = format_job_table_name(job_id, table_name)
        config = configparser.ConfigParser()
        config.read(os.path.join(config_folder, file))
        if 'Struct' not in config:
            continue
        columns = config['Struct']
        create_statement = f"CREATE TABLE {job_table_name} (\n"
        create_statement += ",\n".join([f"  {col} {get_data_type(col, date_types)}" for col in columns])
        create_statement += "\n)\n"
        table_names_and_create_job_table_statements.append((table_name, job_table_name, create_statement))

    return table_names_and_create_job_table_statements

def create_job_tables(job_id: str, cx_id: str):
    database_name = format_database_name(cx_id)
    with snowflake.connector.connect(**get_snowflake_credentials(), autocommit=False) as snowflake_conn:
        snowflake_conn.cursor().execute(f"CREATE DATABASE IF NOT EXISTS {database_name}")
        snowflake_conn.cursor().execute(f"USE DATABASE {database_name}")
        snowflake_conn.cursor().execute("USE SCHEMA PUBLIC")
        tables = generate_table_names_and_create_table_statements(job_id)
        for _, job_table_name, create_job_table_statement in tables:
            snowflake_conn.cursor().execute(f"DROP TABLE IF EXISTS {job_table_name}")
            snowflake_conn.cursor().execute(create_job_table_statement)
        snowflake_conn.commit()

def rename_job_tables(job_id: str, cx_id: str):
    database_name = format_database_name(cx_id)
    with snowflake.connector.connect(**get_snowflake_credentials(), autocommit=False) as snowflake_conn:
        snowflake_conn.cursor().execute(f"USE DATABASE {database_name}")
        snowflake_conn.cursor().execute("USE SCHEMA PUBLIC")
        tables = generate_table_names_and_create_table_statements(job_id)
        for table_name, job_table_name, _ in tables:
            snowflake_conn.cursor().execute(f"DROP TABLE IF EXISTS {table_name}")
            snowflake_conn.cursor().execute(f"ALTER TABLE {job_table_name} RENAME TO {table_name}")
        snowflake_conn.commit()

def append_job_tables(job_id: str, cx_id: str, patient_id: str, rebuild_patient: bool = False):
    database_name = format_database_name(cx_id)
    with snowflake.connector.connect(**get_snowflake_credentials(), autocommit=False) as snowflake_conn:
        snowflake_conn.cursor().execute(f"USE DATABASE {database_name}")
        snowflake_conn.cursor().execute("USE SCHEMA PUBLIC")
        tables = generate_table_names_and_create_table_statements(job_id)
        for table_name, job_table_name, _ in tables:
            snowflake_conn.cursor().execute(f"CREATE TABLE IF NOT EXISTS {table_name} LIKE {job_table_name}")
            if rebuild_patient:
                snowflake_conn.cursor().execute(f"""
                DELETE FROM {table_name} 
                WHERE filename like '%{patient_id}%'
                """)
            snowflake_conn.cursor().execute(f"INSERT INTO {table_name} SELECT * FROM {job_table_name}")
            snowflake_conn.cursor().execute(f"DROP TABLE IF EXISTS {job_table_name}")
        snowflake_conn.commit()

def copy_into_job_table(job_id: str, cx_id: str, s3_bucket: str, file_key: str, table_name: str):
    database_name = format_database_name(cx_id)
    stage_name = format_stage_name(file_key)
    file_parts = file_key.split('/')
    file_name = file_parts[-1]
    file_path = '/'.join(file_parts[:-1])
    url = f"s3://{s3_bucket}/{file_path}/"
    with snowflake.connector.connect(**get_snowflake_credentials(), autocommit=False) as snowflake_conn:
        job_table_name = format_job_table_name(job_id, table_name)
        try:
            snowflake_conn.cursor().execute(f"USE DATABASE {database_name}")
            snowflake_conn.cursor().execute("USE SCHEMA PUBLIC")
            snowflake_conn.cursor().execute(f"DROP STAGE IF EXISTS {stage_name}")
            snowflake_conn.cursor().execute(f"""
            CREATE STAGE {stage_name}
            STORAGE_INTEGRATION = {snowflake_integration}
            URL = '{url}';
            """)
            snowflake_conn.cursor().execute(f"""
            COPY INTO {job_table_name} 
            FROM @{stage_name}
            FILE_FORMAT = (TYPE = CSV FIELD_DELIMITER = ',', ESCAPE = '\\\\', FIELD_OPTIONALLY_ENCLOSED_BY = '\"')
            FILES = ('{file_name}')
            """)
            snowflake_conn.cursor().execute(f"DROP STAGE IF EXISTS {stage_name}")
            snowflake_conn.commit()
        except Exception as e:
            logging.error(f"Error copying data to snowflake from stage {stage_name} to table {job_table_name}. Cause: {e}")
            return
