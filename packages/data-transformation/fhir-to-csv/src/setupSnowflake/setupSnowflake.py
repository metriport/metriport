import os
import configparser
import logging
import json
from src.utils.database import (
    format_table_name_from_config_file_name,
    format_job_table_name,
    format_patient_status_table_name,
    format_stage_name,
    get_data_type,
)

logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s - %(message)s'
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
    logging.info('Running generate_table_names_and_create_table_statements for pt "%s", job "%s"', patient_id, job_id)
    for file in os.listdir(config_folder):
        if not file.endswith(".ini"):
            continue
        logging.info('Loading config "%s"', file)
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
    logging.info('Running create_job_tables for cx "%s", pt "%s", job "%s"', cx_id, patient_id, job_id)
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
    logging.info('Running copy_into_resource_table for cx "%s", pt "%s", job "%s"', cx_id, patient_id, job_id)
    for table_name, columns_list, create_resource_table_statement, job_table_name, _ in table_defs:
        logging.info('...creating if not exists %s', table_name)
        snowflake_conn.cursor().execute(create_resource_table_statement)
        if rebuild_patient:
            logging.info('...replacing entries on resource table "%s" from job table "%s"', table_name, job_table_name)
            snowflake_conn.cursor().execute(f"DELETE FROM {table_name} WHERE filename like '%{patient_id}%'")
        else:
            logging.info('...appending to resource table "%s" from job table "%s"', table_name, job_table_name)
        snowflake_conn.cursor().execute(f"INSERT INTO {table_name} ({columns_list}) SELECT * FROM {job_table_name}")
        snowflake_conn.cursor().execute(f"DROP TABLE IF EXISTS {job_table_name}")

def create_stage(snowflake_conn, cx_id: str, patient_id: str, job_id: str, s3_bucket: str, output_file_prefix: str):
    logging.info('Running create_stage for cx "%s", pt "%s", job "%s"', cx_id, patient_id, job_id)
    stage_name = format_stage_name(cx_id, patient_id, job_id)
    logging.info('...stage_name "%s"', stage_name)
    file_path = output_file_prefix
    url = f"s3://{s3_bucket}/{file_path}/"
    logging.info('...S3 url "%s"', url)
    snowflake_conn.cursor().execute(f"DROP STAGE IF EXISTS {stage_name}")
    snowflake_conn.cursor().execute(f"""
        CREATE STAGE {stage_name}
        STORAGE_INTEGRATION = {snowflake_integration}
        URL = '{url}';
        """)

def drop_stage(snowflake_conn, cx_id: str, patient_id: str, job_id: str):
    logging.info('Running drop_stage for cx "%s", pt "%s", job "%s"', cx_id, patient_id, job_id)
    stage_name = format_stage_name(cx_id, patient_id, job_id)
    logging.info('...stage_name "%s"', stage_name)
    snowflake_conn.cursor().execute(f"DROP STAGE IF EXISTS {stage_name}")

def copy_into_job_table(snowflake_conn, cx_id: str, patient_id: str, job_id: str, s3_bucket: str, file_key: str, table_name: str):
    logging.info('Running copy_into_job_table for cx "%s", file "%s", table "%s"', cx_id, file_key, table_name)
    stage_name = format_stage_name(cx_id, patient_id, job_id)
    file_parts = file_key.split('/')
    file_name = file_parts[-1]
    file_path = '/'.join(file_parts[:-1])
    url = f"s3://{s3_bucket}/{file_path}/"
    logging.info('...S3 url "%s"', url)
    job_table_name = format_job_table_name(patient_id, job_id, table_name)
    snowflake_conn.cursor().execute(f"""
        COPY INTO {job_table_name} 
        FROM @{stage_name}
        FILE_FORMAT = (TYPE = CSV FIELD_DELIMITER = ',', ESCAPE = '\\\\', FIELD_OPTIONALLY_ENCLOSED_BY = '\"')
        FILES = ('{file_name}')
        """)

def set_patient_status(snowflake_conn, cx_id: str, patient_id: str, status: str):
    logging.info('Running set_patient_status for cx "%s", pt "%s", status "%s"', cx_id, patient_id, status)
    table_name = format_patient_status_table_name()
    snowflake_conn.cursor().execute(f"CREATE HYBRID TABLE IF NOT EXISTS {table_name} (ID VARCHAR(255) PRIMARY KEY, STATUS VARCHAR(255))")
    snowflake_conn.cursor().execute(f"DELETE FROM {table_name} WHERE ID = '{patient_id}'")
    snowflake_conn.cursor().execute(f"INSERT INTO {table_name} (ID, STATUS) VALUES ('{patient_id}', '{status}')")

