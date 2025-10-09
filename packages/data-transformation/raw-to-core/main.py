from dbt.cli.main import dbtRunner
import os
import boto3
import sys
import gzip
import csv
import time

bucket_name = 'tuva-public-resources'

# Define only the enabled terminology files
terminology_files = [
    'act_site.csv',
    'cvx.csv',
    'hcpcs_level_2.csv',
    'icd_10_cm.csv',
    'icd_10_pcs.csv',
    'icd_9_cm.csv',
    'icd_9_pcs.csv',
    'immunization_route_code.csv',
    'immunization_status.csv',
    'immunization_status_reason.csv',
    'loinc.csv',
    'ndc.csv',
    'observation_type.csv',
    'rxnorm_to_atc.csv',
    'snomed_ct.csv'
]

def handler(event: dict, context: dict):
    host = os.getenv("HOST") or os.getenv("DBT_PG_HOST")
    if not host:
        raise ValueError("Missing required environment variables: HOST")
    os.environ['DBT_PG_HOST'] = host

    user = os.getenv("USER") or os.getenv("DBT_PG_USER")
    if not user:
        raise ValueError("Missing required environment variables: USER")
    os.environ['DBT_PG_USER'] = user

    password = os.getenv("PASSWORD") or os.getenv("DBT_PG_PASSWORD")
    if not password:
        raise ValueError("Missing required environment variables: PASSWORD")
    os.environ['DBT_PG_PASSWORD'] = password

    cliDatabase = sys.argv[1] if len(sys.argv) > 1 else None
    database = cliDatabase or os.getenv("DATABASE") or os.getenv("DBT_PG_DATABASE")
    if not database:
        raise ValueError("Missing required environment variables: DATABASE")
    os.environ['DBT_PG_DATABASE'] = database

    cliSchema = sys.argv[2] if len(sys.argv) > 2 else None
    schema = cliSchema or os.getenv("SCHEMA") or os.getenv("DBT_PG_SCHEMA")
    if not schema:
        raise ValueError("Missing required environment variables: SCHEMA")
    os.environ['DBT_PG_SCHEMA'] = schema

    print(f"Downloading {len(terminology_files)} terminology files from {bucket_name} to {schema}")
    s3_client = boto3.client("s3")
    
    # Start timing the download process
    download_start_time = time.time()
    
    for filename in terminology_files:
        # Determine the S3 key based on filename
        if filename in ['other_provider_taxonomy.csv', 'provider.csv']:
            # These files are in versioned_provider_data folder
            s3_key = f"versioned_provider_data/0.15.1/{filename}_0_0_0.csv.gz"
        else:
            # All other files are in versioned_terminology folder
            s3_key = f"versioned_terminology/0.15.1/{filename}_0_0_0.csv.gz"
        
        # Set up file paths
        output_compressed_file = f"seeds/terminology/terminology__{filename}.gz"
        output_file = f"seeds/terminology/terminology__{filename}"
        
        try:
            # Download the compressed file from S3
            s3_client.download_file(bucket_name, s3_key, output_compressed_file)
            print(f"Downloaded {s3_key} from S3")

            # Read compressed rows from the file
            with gzip.open(output_compressed_file, 'rt', encoding='utf-8') as f_in:
                new_rows = f_in.readlines()

            # Check if the output_file exists and has only one row (header)
            if os.path.exists(output_file):
                with open(output_file, 'r', encoding='utf-8') as f_existing:
                    existing_rows = f_existing.readlines()
                if len(existing_rows) == 1:
                    # Write header from existing file, then all new rows
                    with open(output_file, 'w', encoding='utf-8') as f_out:
                        f_out.write(existing_rows[0] + '\n')  # Write existing header
                        f_out.writelines(new_rows)  # Write all new rows (no header to skip)
                    print(f"Appended {len(new_rows)} rows to {output_file} (existing header kept)")
                else:
                    print(f"{output_file} already has data, skipping append")
            else:
                # Write all new rows to new file
                with open(output_file, 'w', encoding='utf-8') as f_out:
                    f_out.writelines(new_rows)
                print(f"Wrote {len(new_rows)} rows to new file {output_file}")

            print(f"Downloaded and processed file {s3_key}")
            
        except Exception as e:
            print(f"Error processing {s3_key}: {str(e)}")
            continue

    # Calculate and display download timing
    download_end_time = time.time()
    download_duration = download_end_time - download_start_time
    print(f"Finished downloading terminology files in {download_duration:.2f} seconds")

    print(f"Running DBT build with database: {database}, schema: {schema}")
    dbt_runner = dbtRunner()
    cli_args = ["build", "--vars", f'{{"input_database": "{database}", "input_schema": "{schema}"}}']
    result = dbt_runner.invoke(cli_args)
    if result.success:
        print("DBT build completed successfully")
    else:
        if result.exception:
            print("DBT build failed with exception:")
            print(result.exception)
            raise RuntimeError("DBT build failed") from result.exception
        print("DBT build failed without exception")
        raise RuntimeError("DBT build failed")

def main():
    """Main entry point for CLI usage."""
    handler({}, {})


if __name__ == "__main__":
    main()        
