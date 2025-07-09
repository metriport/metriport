import snowflake.connector
import os
import configparser
import logging
from src.utils.environment import Environment
from src.utils.database import format_database_name, format_table_name, get_data_type
from src.utils.file import create_upload_path_with_table_name

def format_stage_name(table_name):
    return f"{table_name}_stage"

def process_ini_files(config_folder: str, date_types=False) -> list[tuple[str, str]]:
    create_table_statements = []
    for file in os.listdir(config_folder):
        if not file.endswith(".ini"):
            continue
        config = configparser.ConfigParser()
        config.read(os.path.join(config_folder, file))
        if 'Struct' not in config:
            continue
        columns = config['Struct']
        table_name = format_table_name(file)
        create_statement = f"CREATE TABLE {table_name} (\n"
        create_statement += ",\n".join([f"  {col} {get_data_type(col, date_types)}" for col in columns])
        create_statement += "\n)\n"
        create_table_statements.append((create_statement, table_name))

    return create_table_statements

def setup_database_and_tables(cx_id,  env: Environment, config_folder, date_types=False):
    database_name = format_database_name(cx_id, env)
    table_names = []
    with snowflake.connector.connect(connection_name="engineering") as snowflake_conn:
        snowflake_conn.cursor().execute(f"CREATE DATABASE IF NOT EXISTS {database_name}")
        snowflake_conn.cursor().execute(f"USE DATABASE {database_name}")
        snowflake_conn.cursor().execute(f"USE SCHEMA PUBLIC")
        create_table_statements = process_ini_files(config_folder, date_types)
        for create_table_statement, table_name in create_table_statements:
            table_names.append(table_name)
            snowflake_conn.cursor().execute(f"DROP TABLE IF EXISTS {table_name}")
            snowflake_conn.cursor().execute(create_table_statement)
    return table_names

def copy_data_to_snowflake(cx_id, env: Environment, s3_bucket, table_names):
    integration_name = os.getenv("SNOWFLAKE_INTEGRATION")
    if not integration_name:
        raise ValueError("SNOWFLAKE_INTEGRATION is not set")
    database_name = format_database_name(cx_id, env)
    with snowflake.connector.connect(connection_name="engineering") as snowflake_conn:
        snowflake_conn.cursor().execute(f"USE DATABASE {database_name}")
        snowflake_conn.cursor().execute(f"USE SCHEMA PUBLIC")
        for table_name in table_names:
            stage_name = format_stage_name(table_name)
            snowflake_conn.cursor().execute(f"DROP STAGE IF EXISTS {stage_name}")
            snowflake_conn.cursor().execute(f"""
            CREATE STAGE {stage_name}
            STORAGE_INTEGRATION = {integration_name}
            URL = 's3://{s3_bucket}/{create_upload_path_with_table_name(cx_id, table_name)}/';
            """)
            try: 
                snowflake_conn.cursor().execute(f"""
                COPY INTO {table_name} 
                FROM @{stage_name}
                FILE_FORMAT = (TYPE = CSV FIELD_DELIMITER = ',' SKIP_HEADER = 1, ESCAPE = '\\\\', FIELD_OPTIONALLY_ENCLOSED_BY = '\"')
                PATTERN = '.*\\.csv'
                """)
            except Exception as e:
                logging.error(f"Error copying data to snowflake from stage {stage_name} to table {table_name}. Cause: {e}")
                continue

def process_snowflake(cx_id, env: Environment, s3_bucket, config_folder, date_types=False):
    table_names = setup_database_and_tables(cx_id, env, config_folder, date_types)
    copy_data_to_snowflake(cx_id, env, s3_bucket, table_names)
