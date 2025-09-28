from dbt.cli.main import dbtRunner
import os
import sys

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

    print(f"Running DBT build with database: {database}, schema: {schema}")
    dbt_runner = dbtRunner()
    cli_args = ["build"]
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
