from dbt.cli.main import dbtRunner
import os
import sys

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
