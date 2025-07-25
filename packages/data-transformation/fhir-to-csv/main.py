import boto3
import os
import logging
import json
import ndjson
from src.parseNdjsonBundle import parseNdjsonBundle
from src.setupSnowflake.setupSnowflake import (
    setup_database,
    create_job_tables,
    append_job_tables,
    copy_into_job_table,
    set_patient_status,
)
from src.utils.environment import Environment
from src.utils.dwh import DWH
from src.utils.file import create_consolidated_key

transform_name = 'fhir-to-csv'

env = Environment(os.getenv("ENV") or Environment.DEV)
dwh = DWH(os.getenv("DWH") or DWH.SNOWFLAKE)

s3_client = boto3.client("s3")

def transform_and_upload_data(
    input_bucket: str,
    output_bucket: str,
    cx_id: str,
    patient_id: str,
    job_id: str,
    input_bundle: str | None,
) -> list[tuple[str, str, str]]:
    bundle_key = ""
    if input_bundle is not None and input_bundle != "":
        bundle_key = input_bundle.strip()
    else:
        bundle_key = create_consolidated_key(cx_id, patient_id)

    local_cx_path = f"/tmp/output/{cx_id}"
    os.makedirs(local_cx_path, exist_ok=True)
    local_patient_path = f"{local_cx_path}/{patient_id}"
    os.makedirs(local_patient_path, exist_ok=True)
    local_bundle_key = f"{local_patient_path}/bundle_{bundle_key.replace('/', '_')}.json"
    with open(local_bundle_key, "wb") as f:
        try:
            logging.info(f"Downloading bundle {bundle_key} from {input_bucket} to {local_bundle_key}")
            s3_client.download_file(input_bucket, bundle_key, local_bundle_key)
            logging.info(f"Downloaded bundle {bundle_key} from {input_bucket} to {local_bundle_key}")
        except s3_client.exceptions.ClientError as e:
            if e.response['Error']['Code'] == '404':
                logging.warning(f"Bundle {bundle_key} not found in input bucket {input_bucket}")
                raise ValueError("Bundle not found") from e
            else:
                raise e
    with open(local_bundle_key, "rb") as f:
        bundle = json.load(f)
        entries = bundle["entry"]
        if entries is None or len(entries) < 1:
            logging.warning(f"Bundle {bundle_key} has no entries")
            return []
        local_ndjson_bundle_key = local_bundle_key.replace(".json", ".ndjson")
        with open(local_ndjson_bundle_key, "w") as f:
            ndjson.dump(entries, f)
        logging.info(f"Parsing bundle {local_ndjson_bundle_key} to {local_patient_path}")
    local_output_files = parseNdjsonBundle.parse(local_ndjson_bundle_key, local_patient_path)

    output_bucket_and_file_keys_and_table_names = []
    for file in local_output_files:
        output_file_key = f"{dwh}/{transform_name}/{cx_id}/{patient_id}/{job_id}/{file.replace('/', '_')}"
        table_name = file.split("/")[-1].replace(".csv", "")
        with open(file, "rb") as f:
            logging.info(f"Uploading file {file} to {output_bucket}/{output_file_key}")
            s3_client.upload_fileobj(f, output_bucket, output_file_key)
        output_bucket_and_file_keys_and_table_names.append((output_bucket, output_file_key, table_name))

    logging.info(f"Done transform_and_upload_data for patient_id {patient_id}")
    return output_bucket_and_file_keys_and_table_names

def handler(event: dict, context: dict):
    cx_id = event.get("CX_ID") or os.getenv("CX_ID")
    patient_id = event.get("PATIENT_ID") or os.getenv("PATIENT_ID")
    job_id = event.get("JOB_ID") or os.getenv("JOB_ID")
    input_bundle = event.get("INPUT_BUNDLE") or os.getenv("INPUT_BUNDLE")
    input_bucket = event.get("INPUT_S3_BUCKET") or os.getenv("INPUT_S3_BUCKET")
    output_bucket = os.getenv("OUTPUT_S3_BUCKET")
    snowflake_creds = event.get("SNOWFLAKE_CREDS") or os.getenv("SNOWFLAKE_CREDS")
    if not cx_id:
        raise ValueError("CX_ID is not set") 
    if not patient_id:
        raise ValueError("PATIENT_ID is not set")
    if not job_id:
        raise ValueError("JOB_ID is not set")
    job_id = job_id.replace(":", "-").replace(".", "-")
    if not input_bucket:
        raise ValueError("INPUT_S3_BUCKET is not set")
    if not output_bucket:
        raise ValueError("OUTPUT_S3_BUCKET is not set")
    if not snowflake_creds:
        raise ValueError("SNOWFLAKE_CREDS is not set")
    snowflake_creds = json.loads(snowflake_creds) if isinstance(snowflake_creds, str) else snowflake_creds

    logging.info(f">>> Parsing data and uploading it to S3 for Snowflake - {cx_id}, patient_id {patient_id}, job_id {job_id}")
    output_bucket_and_file_keys_and_table_names = transform_and_upload_data(
        input_bucket,
        output_bucket,
        cx_id,
        patient_id,
        job_id,
        input_bundle,
    )

    if len(output_bucket_and_file_keys_and_table_names) < 1:
        logging.info("No files were uploaded")
        exit(0)

    logging.info(f">>> Uploading data into Snowflake - {cx_id}, patient_id {patient_id}, job_id {job_id}")
    setup_database(snowflake_creds, cx_id)
    set_patient_status(snowflake_creds, cx_id, patient_id, "processing")

    create_job_tables(snowflake_creds, cx_id, patient_id, job_id)
    for output_bucket, output_file_key, table_name in output_bucket_and_file_keys_and_table_names:
        copy_into_job_table(snowflake_creds, cx_id, patient_id, job_id, output_bucket, output_file_key, table_name)

    rebuild_patient = input_bundle is None or input_bundle == ""
    append_job_tables(snowflake_creds, cx_id, patient_id, job_id, rebuild_patient)

    set_patient_status(snowflake_creds, cx_id, patient_id, "completed")
    logging.info(f">>> Done processing {cx_id}, patient_id {patient_id}, job_id {job_id}")

if __name__ == "__main__":
    handler({}, {})
