import boto3
import os
import configparser
from src.utils.environment import Environment
from src.utils.dwh import DWH
from src.utils.database import format_database_name, format_table_name, get_data_type
from src.utils.file import create_upload_path_with_table_name

aws_region = os.getenv("AWS_REGION")
glue_client = boto3.client("glue", region_name=aws_region)
athena_client = boto3.client("athena", region_name=aws_region)

def process_ini_files(cx_id, s3_bucket, config_folder: str, date_types=False) -> list[tuple[str, str]]:
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
        create_statement = f"CREATE EXTERNAL TABLE {table_name} (\n"
        create_statement += ",\n".join([f"  {col} {get_data_type(col, date_types, 'string')}" for col in columns])
        create_statement += "\n)\n"
        create_statement += f"ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'\n"
        create_statement += f"WITH SERDEPROPERTIES ('separatorChar' = ',', 'escapeChar' = '\\\\', 'quoteChar' = '\"')\n"
        create_statement += f"LOCATION 's3://{s3_bucket}/{create_upload_path_with_table_name(DWH.ATHENA, cx_id, table_name)}/'\n"
        create_statement += f"TBLPROPERTIES ('skip.header.line.count'='1');\n"
        create_table_statements.append((create_statement, table_name))

    return create_table_statements

def process_athena(athena_work_group, cx_id, env: Environment, s3_bucket, config_folder, date_types=False):
    database_name = format_database_name(cx_id, env)
    try:
        glue_client.create_database(
            DatabaseInput={
                "Name": database_name
            }
        )
    except glue_client.exceptions.AlreadyExistsException:
        pass
    create_table_statements = process_ini_files(cx_id, s3_bucket, config_folder, date_types)
    for create_table_statement, table_name in create_table_statements:
        try:
            glue_client.delete_table(
                DatabaseName=database_name,
                Name=table_name
            )
        except glue_client.exceptions.EntityNotFoundException:
            pass
        athena_client.start_query_execution(
            QueryString=create_table_statement,
            QueryExecutionContext={
                "Database": database_name
            },
            ResultConfiguration={
                "OutputLocation": f"s3://{s3_bucket}/athena-output/{cx_id}"
            },
            WorkGroup=athena_work_group,
        )
