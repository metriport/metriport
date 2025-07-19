import boto3
import os
import logging
import json
import ndjson
from src.parseNdjsonBundle import parseNdjsonBundle
from src.setupSnowflake.setupSnowflake import (
    create_job_tables,
    rename_job_tables,
    append_job_tables,
    copy_into_job_table,
)
from src.utils.environment import Environment
from src.utils.dwh import DWH
from src.utils.metriport_api import get_patient_ids
from src.utils.file import create_consolidated_key

transform_name = 'fhir-to-csv'

env = Environment(os.getenv("ENV") or Environment.DEV)
dwh = DWH(os.getenv("DWH") or DWH.SNOWFLAKE)

s3_client = boto3.client("s3")

def transform_and_upload_data(
    input_bucket: str,
    output_bucket: str,
    api_url: str,
    job_id: str,
    cx_id: str,
    patient_id: str | None,
    input_bundle: str | None,
) -> list[tuple[str, str, str]]:
    patient_ids_and_bundle_keys = []
    if input_bundle is not None and input_bundle != "":
        if patient_id is None or patient_id == "":
            raise ValueError("PATIENT_ID must be set when INPUT_BUNDLE is set")
        patient_ids_and_bundle_keys = [(patient_id, input_bundle.strip())]
    else:
        patient_ids = [patient_id] if patient_id is not None and patient_id != "" else get_patient_ids(api_url, cx_id)
        patient_ids_and_bundle_keys = [(patient_id, create_consolidated_key(cx_id, patient_id)) for patient_id in patient_ids]
    if len(patient_ids_and_bundle_keys) < 1:
        raise ValueError("No patient and bundle keys found")

    local_output_files = []
    local_cx_path = f"/tmp/output/{cx_id}"
    os.makedirs(local_cx_path, exist_ok=True)
    for patient_id, bundle_key in patient_ids_and_bundle_keys:
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
                    continue
                else:
                    raise e
        with open(local_bundle_key, "rb") as f:
            bundle = json.load(f)
            entries = bundle["entry"]
            if entries is None or len(entries) < 1:
                logging.warning(f"Bundle {bundle_key} has no entries")
                continue
            local_ndjson_bundle_key = local_bundle_key.replace(".json", ".ndjson")
            with open(local_ndjson_bundle_key, "w") as f:
                ndjson.dump(entries, f)
            logging.info(f"Parsing bundle {local_ndjson_bundle_key} to {local_patient_path}")
            local_output_files.extend(parseNdjsonBundle.parse(local_ndjson_bundle_key, local_patient_path))

    output_bucket_and_file_keys_and_table_names = []
    for file in local_output_files:
        output_file_key = f"{dwh}/{transform_name}/{cx_id}/{job_id}/{file.replace('/', '_')}"
        table_name = file.split("/")[-1].replace(".csv", "")
        with open(file, "rb") as f:
            logging.info(f"Uploading file {file} to {output_bucket}/{output_file_key}")
            s3_client.upload_fileobj(f, output_bucket, output_file_key)
            logging.info(f"Uploaded file {file} to {output_bucket}/{output_file_key}")
        output_bucket_and_file_keys_and_table_names.append((output_bucket, output_file_key, table_name))

    return output_bucket_and_file_keys_and_table_names

def handler(event: dict, context: dict):
    print(f"event: {event}")
    print(f"context: {context}")
    api_url = event.get("API_URL") or os.getenv("API_URL")
    job_id = event.get("JOB_ID") or os.getenv("JOB_ID")
    cx_id = event.get("CX_ID") or os.getenv("CX_ID")
    patient_id = event.get("PATIENT_ID") or os.getenv("PATIENT_ID")
    input_bundle = event.get("INPUT_BUNDLE") or os.getenv("INPUT_BUNDLE")
    input_bucket = event.get("INPUT_S3_BUCKET") or os.getenv("INPUT_S3_BUCKET")
    output_bucket = os.getenv("OUTPUT_S3_BUCKET")
    snowflake_creds = event.get("SNOWFLAKE_CREDS") or os.getenv("SNOWFLAKE_CREDS")
    if not api_url:
        raise ValueError("API_URL is not set")
    if not job_id:
        raise ValueError("JOB_ID is not set")
    if not cx_id:
        raise ValueError("CX_ID is not set") 
    if not input_bucket:
        raise ValueError("INPUT_S3_BUCKET is not set")
    if not output_bucket:
        raise ValueError("OUTPUT_S3_BUCKET is not set")
    if not snowflake_creds:
        raise ValueError("SNOWFLAKE_CREDS is not set")
    snowflake_creds = json.loads(snowflake_creds) if isinstance(snowflake_creds, str) else snowflake_creds

    output_bucket_and_file_keys_and_table_names = transform_and_upload_data(
        input_bucket,
        output_bucket,
        api_url,
        job_id,
        cx_id,
        patient_id,
        input_bundle,
    )

    if len(output_bucket_and_file_keys_and_table_names) < 1:
        logging.info("No files to upload")
        exit(0)

    create_job_tables(snowflake_creds, job_id, cx_id)
    for output_bucket, output_file_key, table_name in output_bucket_and_file_keys_and_table_names:
        copy_into_job_table(snowflake_creds, job_id, cx_id, output_bucket, output_file_key, table_name)

    if patient_id is not None and patient_id != "":
        rebuild_patient = input_bundle is None or input_bundle == ""
        append_job_tables(snowflake_creds, job_id, cx_id, patient_id, rebuild_patient)
    else:
        rename_job_tables(snowflake_creds, job_id, cx_id)

if __name__ == "__main__":
    handler({}, {})
