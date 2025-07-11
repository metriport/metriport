import boto3
import os
import logging
import json
import ndjson
from src.parseNdjsonBundle import parseNdjsonBundle
from src.setupSnowflake.setupSnowflake import process_snowflake
from src.setupAthena.setupAthena import process_athena
from src.utils.environment import Environment
from src.utils.dwh import DWH
from src.utils.file import (
    create_upload_path,
    create_bundle_path_and_file_name,
    create_output_path,
    consolidated_data_file_suffix,
    parse_parser_file_name,
    create_upload_path_with_table_name,
)

env = Environment(os.getenv("ENV") or Environment.DEV)
dwh = DWH(os.getenv("DWH") or DWH.SNOWFLAKE)

s3_client = boto3.client("s3")
input_bucket = os.getenv("INPUT_S3_BUCKET")
output_bucket = os.getenv("OUTPUT_S3_BUCKET")
cx_id = os.getenv("CX_ID")
config_folder = os.getenv("CONFIG_FOLDER")

def transform_and_upload_data(input_bucket: str, output_bucket: str, cx_id: str, config_folder: str):
    response = s3_client.list_objects_v2(Bucket=input_bucket, Prefix=cx_id)
    output_file_path = create_output_path(cx_id, env)

    objects = response.get("Contents", [])
    if len(objects) < 1:
        logging.info("No files found in input bucket")
        return

    for obj in objects:
        s3_bundle_file_key = obj["Key"]
        if not s3_bundle_file_key.endswith(consolidated_data_file_suffix):
            continue
        local_bundle_path, local_bundle_file_name = create_bundle_path_and_file_name(cx_id, env, s3_bundle_file_key)
        local_bundle_file_key = f"{local_bundle_path}/{local_bundle_file_name}"
        with open(local_bundle_file_key, "wb") as f:
            s3_client.download_file(input_bucket, s3_bundle_file_key, local_bundle_file_key)
        bundle = json.load(open(local_bundle_file_key))
        entries = bundle["entry"]
        if entries is None or len(entries) < 1:
            continue
        local_bundle_file_key_ndjson = local_bundle_file_key.replace(".json", ".ndjson")
        with open(local_bundle_file_key_ndjson, "w") as f:
            ndjson.dump(entries, f)
        parseNdjsonBundle.parseAndAppendToFile(local_bundle_file_key_ndjson, output_file_path, config_folder)

    output_files = os.listdir(output_file_path)
    if len(output_files) < 1:
        msg = "No output files found"
        logging.error(msg)
        raise ValueError(msg)

    upload_file_path = create_upload_path(dwh, cx_id)
    try:
        s3_client.delete_objects(Bucket=output_bucket, Delete={"Prefix": upload_file_path})
    except Exception as e:
        logging.error(f"Error deleting objects with prefix {upload_file_path}: {e}")
        pass

    for output_file_name in output_files:
        table_name = parse_parser_file_name(output_file_name, parseNdjsonBundle.output_format)
        with open(f"{output_file_path}/{output_file_name}", "rb") as f:
            s3_client.upload_fileobj(f, output_bucket, f"{create_upload_path_with_table_name(dwh, cx_id, table_name)}/{output_file_name}")

    return

if __name__ == "__main__":
    if not input_bucket:
        raise ValueError("INPUT_S3_BUCKET is not set")
    if not output_bucket:
        raise ValueError("OUTPUT_S3_BUCKET is not set")
    if not cx_id:
        raise ValueError("CX_ID is not set")
    if not config_folder:
        raise ValueError("CONFIG_FOLDER is not set")    
    transform_and_upload_data(input_bucket, output_bucket, cx_id, config_folder)
    if dwh == DWH.SNOWFLAKE:
        process_snowflake(cx_id, env, output_bucket, config_folder)
    elif dwh == DWH.ATHENA:
        athena_work_group = os.getenv("ATHENA_WORK_GROUP")
        if not athena_work_group:
            raise ValueError("ATHENA_WORK_GROUP is not set")
        process_athena(athena_work_group, cx_id, env, output_bucket, config_folder)
