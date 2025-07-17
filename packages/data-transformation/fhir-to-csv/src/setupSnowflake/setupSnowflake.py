import snowflake.connector
import os
import configparser
import logging
from src.utils.database import (
    format_database_name,
    format_table_name_from_config_file_name,
    format_temp_table_name,
    format_stage_name,
    get_data_type,
)

# Define base paths
config_folder = 'src/parseFhir/configurations/'

snowflake_integration = os.getenv("SNOWFLAKE_INTEGRATION")
if snowflake_integration is None:
    raise ValueError("SNOWFLAKE_INTEGRATION is not set")

def get_snowflake_credentials() -> dict[str, str]:
    snowflake_account = os.getenv("SNOWFLAKE_ACCOUNT")
    snowflake_user = os.getenv("SNOWFLAKE_USER")
    snowflake_password = os.getenv("SNOWFLAKE_PASSWORD")
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

def generate_table_names_and_create_temp_table_statements(date_types=False) -> list[tuple[str, str]]:
    table_names_and_create_temp_table_statements = []
    for file in os.listdir(config_folder):
        if not file.endswith(".ini"):
            continue
        table_name = format_table_name_from_config_file_name(file)
        config = configparser.ConfigParser()
        config.read(os.path.join(config_folder, file))
        if 'Struct' not in config:
            continue
        columns = config['Struct']
        create_statement = f"CREATE TABLE {format_temp_table_name(table_name)} (\n"
        create_statement += ",\n".join([f"  {col} {get_data_type(col, date_types)}" for col in columns])
        create_statement += "\n)\n"
        table_names_and_create_temp_table_statements.append((table_name, create_statement))

    return table_names_and_create_temp_table_statements

def create_temp_tables(cx_id: str):
    database_name = format_database_name(cx_id)
    with snowflake.connector.connect(**get_snowflake_credentials(), autocommit=False) as snowflake_conn:
        snowflake_conn.cursor().execute(f"CREATE DATABASE IF NOT EXISTS {database_name}")
        snowflake_conn.cursor().execute(f"USE DATABASE {database_name}")
        snowflake_conn.cursor().execute(f"USE SCHEMA PUBLIC")
        tables = generate_table_names_and_create_temp_table_statements()
        for table_name, create_temp_table_statement in tables:
            snowflake_conn.cursor().execute(f"DROP TABLE IF EXISTS {format_temp_table_name(table_name)}")
            snowflake_conn.cursor().execute(create_temp_table_statement)
        snowflake_conn.commit()

def rename_temp_tables(cx_id: str):
    database_name = format_database_name(cx_id)
    with snowflake.connector.connect(**get_snowflake_credentials(), autocommit=False) as snowflake_conn:
        snowflake_conn.cursor().execute(f"USE DATABASE {database_name}")
        snowflake_conn.cursor().execute(f"USE SCHEMA PUBLIC")
        tables = generate_table_names_and_create_temp_table_statements()
        for table_name, _ in tables:
            snowflake_conn.cursor().execute(f"DROP TABLE IF EXISTS {table_name}")
            snowflake_conn.cursor().execute(f"ALTER TABLE {format_temp_table_name(table_name)} RENAME TO {table_name}")
        snowflake_conn.commit()

def append_temp_tables(cx_id: str, patient_id: str, rebuild_patient: bool = False):
    database_name = format_database_name(cx_id)
    with snowflake.connector.connect(**get_snowflake_credentials(), autocommit=False) as snowflake_conn:
        snowflake_conn.cursor().execute(f"USE DATABASE {database_name}")
        snowflake_conn.cursor().execute(f"USE SCHEMA PUBLIC")
        tables = generate_table_names_and_create_temp_table_statements()
        for table_name, _ in tables:
            if rebuild_patient and table_name == 'condition_code_coding':
                snowflake_conn.cursor().execute(f"""
                DELETE FROM {table_name} 
                WHERE condition_id in (
                    select id from condition
                    where meta_source like '%{patient_id}%'
                )
                """)
            elif rebuild_patient and table_name == 'familymemberhistory_condition':
                snowflake_conn.cursor().execute(f"""
                DELETE FROM {table_name} 
                WHERE filename like '%{patient_id}%'
                """)
            elif rebuild_patient and table_name == 'medicationdispense':
                snowflake_conn.cursor().execute(f"""
                DELETE FROM {table_name} 
                WHERE filename like '%{patient_id}%'
                """)
            elif rebuild_patient and table_name == 'patient_address':
                snowflake_conn.cursor().execute(f"""
                DELETE FROM {table_name} 
                WHERE patient_id in (
                    select id from patient
                    where meta_source like '%{patient_id}%'
                )
                """)
            elif rebuild_patient:
                snowflake_conn.cursor().execute(f"""
                DELETE FROM {table_name} 
                WHERE meta_source like '%{patient_id}%'
                """)
            snowflake_conn.cursor().execute(f"INSERT INTO {table_name} SELECT * FROM {format_temp_table_name(table_name)}")
            snowflake_conn.cursor().execute(f"DROP TABLE IF EXISTS {format_temp_table_name(table_name)}")
        snowflake_conn.commit()

def copy_into_temp_table(cx_id: str, s3_bucket: str, file_key: str, table_name: str):
    database_name = format_database_name(cx_id)
    stage_name = format_stage_name(file_key)
    file_parts = file_key.split('/')
    file_name = file_parts[-1]
    file_path = '/'.join(file_parts[:-1])
    url = f"s3://{s3_bucket}/{file_path}/"
    print(url)
    with snowflake.connector.connect(**get_snowflake_credentials(), autocommit=False) as snowflake_conn:
        try:
            snowflake_conn.cursor().execute(f"USE DATABASE {database_name}")
            snowflake_conn.cursor().execute(f"USE SCHEMA PUBLIC")
            snowflake_conn.cursor().execute(f"DROP STAGE IF EXISTS {stage_name}")
            snowflake_conn.cursor().execute(f"""
            CREATE STAGE {stage_name}
            STORAGE_INTEGRATION = {snowflake_integration}
            URL = '{url}';
            """)
            snowflake_conn.cursor().execute(f"""
            COPY INTO {format_temp_table_name(table_name)} 
            FROM @{stage_name}
            FILE_FORMAT = (TYPE = CSV FIELD_DELIMITER = ',', ESCAPE = '\\\\', FIELD_OPTIONALLY_ENCLOSED_BY = '\"')
            FILES = ('{file_name}')
            """)
            snowflake_conn.cursor().execute(f"DROP STAGE IF EXISTS {stage_name}")
            snowflake_conn.commit()
        except Exception as e:
            logging.error(f"Error copying data to snowflake from stage {stage_name} to table {table_name}. Cause: {e}")
            return
