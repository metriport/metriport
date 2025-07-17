import boto3
import os
import logging
import json
import ndjson
from src.parseNdjsonBundle import parseNdjsonBundle
from src.setupSnowflake.setupSnowflake import (
    create_temp_tables,
    rename_temp_tables,
    append_temp_tables,
    copy_into_temp_table,
)
from src.utils.environment import Environment
from src.utils.dwh import DWH
from src.utils.metriport_api import get_patient_ids
from src.utils.file import create_consolidated_key

transform_name = 'fhir-to-csv'

env = Environment(os.getenv("ENV") or Environment.DEV)
dwh = DWH(os.getenv("DWH") or DWH.SNOWFLAKE)

s3_client = boto3.client("s3")
input_bucket = os.getenv("INPUT_S3_BUCKET")
output_bucket = os.getenv("OUTPUT_S3_BUCKET")
api_url = os.getenv("API_URL")
job_id = os.getenv("JOB_ID")
cx_id = os.getenv("CX_ID")
patient_id = os.getenv("PATIENT_ID")
bundles_to_append = os.getenv("BUNDLES_TO_APPEND")

def transform_and_upload_data(
    input_bucket: str,
    output_bucket: str,
    api_url: str,
    job_id: str,
    cx_id: str,
    patient_id: str | None,
    bundles_to_append: str | None,
) -> list[tuple[str, str, str]]:
    is_single_patient = patient_id is not None
    patient_ids_and_bundle_keys = []
    if bundles_to_append:
        if not patient_id:
            raise ValueError("PATIENT_ID must be set when BUNDLES_TO_APPEND is set")
        patient_ids_and_bundle_keys = [(patient_id, key.strip()) for key in bundles_to_append.split(",")]
    else:
        patient_ids = [patient_id] if patient_id else get_patient_ids(api_url, cx_id)
        patient_ids_and_bundle_keys = [(patient_id, create_consolidated_key(cx_id, patient_id)) for patient_id in patient_ids]
    if len(patient_ids_and_bundle_keys) < 1:
        raise ValueError("No patient and bundle keys found")

    local_output_files = []
    local_cx_path = f"output/{cx_id}"
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
    for file in set(local_output_files):
        output_file_key = f"{dwh}/{transform_name}/{cx_id}/{job_id}/{file.replace('/', '_')}"
        table_name = file.split("/")[-1].replace(".csv", "")
        with open(file, "rb") as f:
            logging.info(f"Uploading file {file} to {output_bucket}/{output_file_key}")
            s3_client.upload_fileobj(f, output_bucket, output_file_key)
            logging.info(f"Uploaded file {file} to {output_bucket}/{output_file_key}")
        output_bucket_and_file_keys_and_table_names.append((output_bucket, output_file_key, table_name))

    return output_bucket_and_file_keys_and_table_names

if __name__ == "__main__":
    if not input_bucket:
        raise ValueError("INPUT_S3_BUCKET is not set")
    if not output_bucket:
        raise ValueError("OUTPUT_S3_BUCKET is not set")
    if not api_url:
        raise ValueError("API_URL is not set")
    if not job_id:
        raise ValueError("JOB_ID is not set")
    if not cx_id:
        raise ValueError("CX_ID is not set") 

    output_bucket_and_file_keys_and_table_names = transform_and_upload_data(
        input_bucket,
        output_bucket,
        api_url,
        job_id,
        cx_id,
        patient_id,
        bundles_to_append,
    )

    if not output_bucket_and_file_keys_and_table_names:
        logging.info("No files to upload")
        exit(0)

    create_temp_tables(cx_id)
    for output_bucket, output_file_key, table_name in output_bucket_and_file_keys_and_table_names:
        copy_into_temp_table(cx_id, output_bucket, output_file_key, table_name)

    if patient_id is not None:
        logging.info(f"Appending patient data for {patient_id} to temp tables")
        rebuild_patient = bundles_to_append is None
        if rebuild_patient:
            logging.info(f"Rebuilding patient data for {patient_id}")
        append_temp_tables(cx_id, patient_id, rebuild_patient)
    else:
        rename_temp_tables(cx_id)
