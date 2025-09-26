import boto3
import os
import shutil
import json
import ndjson
from concurrent.futures import ThreadPoolExecutor, as_completed
from src.parseNdjsonBundle import parseNdjsonBundle
from src.utils.environment import Environment
from src.utils.file import create_consolidated_key

transform_name = 'fhir-to-csv'

env = Environment(os.getenv("ENV") or Environment.DEV)

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
    input_bucket = event.get("INPUT_S3_BUCKET") or os.getenv("INPUT_S3_BUCKET")
    output_bucket = event.get("OUTPUT_S3_BUCKET") or os.getenv("OUTPUT_S3_BUCKET")
    # Will append '/<table_name>.csv' to output_file_prefix
    output_file_prefix = event.get("OUTPUT_PREFIX") or os.getenv("OUTPUT_PREFIX")
    if not cx_id:
        raise ValueError("CX_ID is not set") 
    if not patient_id:
        raise ValueError("PATIENT_ID is not set")
    if not input_bucket:
        raise ValueError("INPUT_S3_BUCKET is not set")
    if not output_bucket:
        raise ValueError("OUTPUT_S3_BUCKET is not set")
    if not output_file_prefix:
        raise ValueError("OUTPUT_PREFIX is not set")

    print(f">>> Parsing data and uploading it to S3 for Snowflake - {cx_id}, patient_id {patient_id}")
    output_bucket_and_file_keys_and_table_names = transform_and_upload_data(
        input_bucket,
        output_bucket,
        cx_id,
        patient_id,
        output_file_prefix,
    )

    if len(output_bucket_and_file_keys_and_table_names) < 1:
        print("No files were uploaded")
        return {"message": "No files were uploaded"}

    print(f">>> Done processing {cx_id}, patient_id {patient_id}")

def main():
    """Main entry point for CLI usage."""
    handler({}, {})

if __name__ == "__main__":
    import sys
    
    # Check if we should run in server mode
    if len(sys.argv) > 1 and sys.argv[1] == "server":
        # Import and run the server
        from server import app
        port = int(os.environ.get('PORT', 8000))
        host = os.environ.get('HOST', '0.0.0.0')
        debug = os.environ.get('DEBUG', 'false').lower() == 'true'
        print(f"Starting FHIR to CSV HTTP server on {host}:{port}")
        app.run(host=host, port=port, debug=debug)
    else:
        # Run in CLI mode (default behavior)
        main()
