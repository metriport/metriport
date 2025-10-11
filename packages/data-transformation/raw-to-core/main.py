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
    profile = os.getenv("PROFILE") or "postgres"
    env_param_prefix = "DBT_SNOWFLAKE" if profile == "snowflake" else "DBT_PG"

    host_suffix = "ACCOUNT" if profile == "snowflake" else "HOST"
    host_env_param = f"{env_param_prefix}_{host_suffix}"
    host = os.getenv(host_suffix) or os.getenv(host_env_param)
    if not host:
        raise ValueError(f"Missing required environment variables: {host_suffix}")
    os.environ[host_env_param] = host

    user_suffix = "USER"
    user_env_param = f"{env_param_prefix}_{user_suffix}" 
    user = os.getenv(user_suffix) or os.getenv(user_env_param)
    if not user:
        raise ValueError(f"Missing required environment variables: {user_suffix}")
    os.environ[user_env_param] = user

    password_suffix = "PASSWORD"
    password_env_param = f"{env_param_prefix}_{password_suffix}"
    password = os.getenv(password_suffix) or os.getenv(password_env_param)
    if not password:
        raise ValueError(f"Missing required environment variables: {password_suffix}")
    os.environ[password_env_param] = password

    if profile == "snowflake":
        role = os.getenv("ROLE") or os.getenv("DBT_SNOWFLAKE_ROLE")
        if not role:
            raise ValueError("Missing required environment variables: ROLE")
        os.environ['DBT_SNOWFLAKE_ROLE'] = role

    cliDatabase = sys.argv[1] if len(sys.argv) > 1 else None
    database_suffix = "DATABASE"
    database_env_param = f"{env_param_prefix}_{database_suffix}"
    database = cliDatabase or os.getenv(database_suffix) or os.getenv(database_env_param)
    if not database:
        raise ValueError(f"Missing required environment variables: {database_suffix}")
    os.environ[database_env_param] = database

    cliSchema = sys.argv[2] if len(sys.argv) > 2 else None
    schema_suffix = "SCHEMA"
    schema_env_param = f"{env_param_prefix}_{schema_suffix}"
    schema = cliSchema or os.getenv(schema_suffix) or os.getenv(schema_env_param)
    if not schema:
        raise ValueError("Missing required environment variables: SCHEMA")
    os.environ[schema_env_param] = schema

    if profile == "snowflake":
        warehouse_suffix = "WAREHOUSE"
        warehouse_env_param = f"{env_param_prefix}_{warehouse_suffix}"
        warehouse = os.getenv(warehouse_suffix) or os.getenv(warehouse_env_param)
        if not warehouse:
            raise ValueError(f"Missing required environment variables: {warehouse_suffix}")
        os.environ[warehouse_env_param] = warehouse

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
    cli_args = ["build", "--target", profile, "--vars", f'{{"input_database": "{database}", "input_schema": "{schema}"}}']
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
