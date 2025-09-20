import boto3
import os
import shutil
import json
import ndjson
import snowflake.connector
from concurrent.futures import ThreadPoolExecutor, as_completed
from src.parseNdjsonBundle import parseNdjsonBundle
from src.utils.environment import Environment
from src.utils.dwh import DWH
from src.utils.file import create_consolidated_key, create_output_file_prefix

transform_name = 'fhir-to-csv'

env = Environment(os.getenv("ENV") or Environment.DEV)
dwh = DWH(os.getenv("DWH") or DWH.SNOWFLAKE)

s3_client = boto3.client("s3")

def upload_file_to_s3(file: str, output_bucket: str, output_file_key: str) -> tuple[str, str, str]:
    """Upload a single file to S3 and return the result tuple."""
    table_name = file.split("/")[-1].replace(".csv", "")
    with open(file, "rb") as f:
        print(f"Uploading file {file} to {output_bucket}/{output_file_key}")
        s3_client.upload_fileobj(f, output_bucket, output_file_key)
    return (output_bucket, output_file_key, table_name)

def transform_and_upload_data(
    input_bucket: str,
    output_bucket: str,
    cx_id: str,
    patient_id: str,
    job_id: str,
    output_file_prefix: str,
) -> list[tuple[str, str, str]]:
    bundle_key = create_consolidated_key(cx_id, patient_id)
    local_cx_path = f"/tmp/{transform_name}/output/{cx_id}"
    os.makedirs(local_cx_path, exist_ok=True)
    local_patient_path = f"{local_cx_path}/{patient_id}"
    os.makedirs(local_patient_path, exist_ok=True)
    local_bundle_key = f"{local_patient_path}/bundle_{bundle_key.replace('/', '_')}.json"
    with open(local_bundle_key, "wb") as f:
        try:
            print(f"Downloading bundle {bundle_key} from {input_bucket} to {local_bundle_key}")
            s3_client.download_file(input_bucket, bundle_key, local_bundle_key)
            print(f"Downloaded bundle {bundle_key} from {input_bucket} to {local_bundle_key}")
        except s3_client.exceptions.ClientError as e:
            if e.response['Error']['Code'] == '404':
                print(f"Bundle {bundle_key} not found in input bucket {input_bucket}")
                raise ValueError("Bundle not found") from e
            else:
                raise e
    with open(local_bundle_key, "rb") as f:
        bundle = json.load(f)
        entries = bundle["entry"]
        if entries is None or len(entries) < 1:
            print(f"Bundle {bundle_key} has no entries")
            return []
        local_ndjson_bundle_key = local_bundle_key.replace(".json", ".ndjson")
        with open(local_ndjson_bundle_key, "w") as f:
            ndjson.dump(entries, f)
        print(f"Parsing bundle {local_ndjson_bundle_key} to {local_patient_path}")
    local_output_files = parseNdjsonBundle.parse(local_ndjson_bundle_key, local_patient_path)

    output_bucket_and_file_keys_and_table_names = []
    
    with ThreadPoolExecutor(max_workers=3) as executor:
        future_to_file = {}
        for file in local_output_files:
            file_name = file.split("/")[-1].replace("/", "_")
            output_file_key = f"{output_file_prefix}/{file_name}"
            future = executor.submit(upload_file_to_s3, file, output_bucket, output_file_key)
            future_to_file[future] = file
        
        for future in as_completed(future_to_file):
            file = future_to_file[future]
            try:
                result = future.result()
                output_bucket_and_file_keys_and_table_names.append(result)
            except Exception as e:
                print(f"Error uploading file {file}: {e}")
                raise e

    print(f"Cleaning up local files in {local_cx_path}")
    shutil.rmtree(local_cx_path)

    print(f"Done transform_and_upload_data for patient_id {patient_id}")
    return output_bucket_and_file_keys_and_table_names

def handler(event: dict, context: dict):
    cx_id = event.get("CX_ID") or os.getenv("CX_ID")
    patient_id = event.get("PATIENT_ID") or os.getenv("PATIENT_ID")
    job_id = event.get("JOB_ID") or os.getenv("JOB_ID")
    input_bucket = event.get("INPUT_S3_BUCKET") or os.getenv("INPUT_S3_BUCKET")
    output_bucket = os.getenv("OUTPUT_S3_BUCKET")
    output_file_prefix = os.getenv("OUTPUT_PREFIX") # Will append '/<cx_id>_<patient_id>_<table_name>.csv' to it
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
    if not output_file_prefix:
        raise ValueError("OUTPUT_PREFIX is not set")

    print(f">>> Parsing data and uploading it to S3 for Snowflake - {cx_id}, patient_id {patient_id}, job_id {job_id}")
    output_bucket_and_file_keys_and_table_names = transform_and_upload_data(
        input_bucket,
        output_bucket,
        cx_id,
        patient_id,
        job_id,
        output_file_prefix,
    )

    if len(output_bucket_and_file_keys_and_table_names) < 1:
        print("No files were uploaded")
        exit(0)

    print(f">>> Done processing {cx_id}, patient_id {patient_id}, job_id {job_id}")

if __name__ == "__main__":
    handler({}, {})
