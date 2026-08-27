from datetime import datetime, timedelta, timezone
from dbt.cli.main import dbtRunner
import os
import sys
import json


def handler(event: dict, context: dict):
    is_server = len(sys.argv) > 1 and sys.argv[1] == "server"
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

    cliDatabase = sys.argv[1] if len(sys.argv) > 1 and not is_server else None
    database_suffix = "DATABASE"
    database_env_param = f"{env_param_prefix}_{database_suffix}"
    database = cliDatabase or os.getenv(database_suffix) or os.getenv(database_env_param)
    if not database:
        raise ValueError(f"Missing required environment variables: {database_suffix}")
    os.environ[database_env_param] = database

    cliSchema = sys.argv[2] if len(sys.argv) > 2 and not is_server else None
    schema_suffix = "SCHEMA"
    schema_env_param = f"{env_param_prefix}_{schema_suffix}"
    schema = cliSchema or os.getenv(schema_suffix) or os.getenv(schema_env_param)
    if not schema:
        raise ValueError(f"Missing required environment variables: {schema_suffix}")
    os.environ[schema_env_param] = schema

    cliJobId = sys.argv[3] if len(sys.argv) > 3 and not is_server else None
    job_id_suffix = "JOB_ID"
    job_id = cliJobId or os.getenv(job_id_suffix)
    if not job_id:
        raise ValueError(f"Missing required environment variables: {job_id_suffix}")
    os.environ[job_id_suffix] = job_id

    cliFullRefresh = sys.argv[4] if len(sys.argv) > 4 and not is_server else None
    full_refresh_suffix = "FULL_REFRESH"
    full_refresh = cliFullRefresh or os.getenv(full_refresh_suffix)
    if not full_refresh:
        raise ValueError(f"Missing required environment variables: {full_refresh_suffix}")
    os.environ[full_refresh_suffix] = full_refresh

    cliLookbackTimestamp = sys.argv[5] if len(sys.argv) > 5 and not is_server else None
    lookback_timestamp_suffix = "LOOKBACK_TIMESTAMP"
    lookback_timestamp = cliLookbackTimestamp or os.getenv(lookback_timestamp_suffix)
    os.environ[lookback_timestamp_suffix] = lookback_timestamp or "none"

    cliLookbackHours = sys.argv[6] if len(sys.argv) > 6 and not is_server else None
    lookback_hours_suffix = "LOOKBACK_HOURS"
    lookback_hours = cliLookbackHours or os.getenv(lookback_hours_suffix)
    os.environ[lookback_hours_suffix] = lookback_hours or "none"

    if profile == "snowflake":
        warehouse_suffix = "WAREHOUSE"
        warehouse_env_param = f"{env_param_prefix}_{warehouse_suffix}"
        warehouse = os.getenv(warehouse_suffix) or os.getenv(warehouse_env_param)
        if not warehouse:
            raise ValueError(f"Missing required environment variables: {warehouse_suffix}")
        os.environ[warehouse_env_param] = warehouse

    lookback_ts = get_lookback_timestamp(full_refresh, lookback_timestamp, lookback_hours)
    print(f"Lookback timestamp: {lookback_ts}")

    vars_dict = {
        "input_database": database,
        "input_schema": schema,
        "input_job_id": job_id,
        "full_refresh": full_refresh,
        "lookback_timestamp": lookback_ts,
    }
    vars_json = json.dumps(vars_dict)

    print(f"Running DBT build with database: {database}, schema: {schema}")
    dbt_runner = dbtRunner()
    cli_args = ["build", "--target", profile, "--vars", vars_json]
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

def get_lookback_timestamp(full_refresh: str, lookback_timestamp: str, lookback_hours: str) -> str:
    if full_refresh and full_refresh.lower() == "true":
        return "1970-01-01 00:00:00"
    if lookback_timestamp and lookback_timestamp != "none":
        return lookback_timestamp
    hours = int(lookback_hours) if lookback_hours and lookback_hours != "none" else 1
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).strftime("%Y-%m-%d %H:%M:%S")

if __name__ == "__main__":
    import sys
    
    # Check if we should run in server mode
    if len(sys.argv) > 1 and sys.argv[1] == "server":
        # Import and run the server
        from server import app
        port = int(os.environ.get('SERVER_PORT', 8000))
        host = os.environ.get('SERVER_HOST', '0.0.0.0')
        debug = os.environ.get('DEBUG', 'false').lower() == 'true'
        print(f"Starting core transform HTTP server on {host}:{port}")
        app.run(host=host, port=port, debug=debug)
    else:
        # Run in CLI mode (default behavior)
        main()
