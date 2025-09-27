from dbt.cli.main import dbtRunner
import os

def handler(event: dict, context: dict):
    host = event.get("HOST") or os.getenv("DBT_PG_HOST")
    os.environ['DBT_PG_HOST'] = host
    user = event.get("USER") or os.getenv("DBT_PG_USER")
    os.environ['DBT_PG_USER'] = user
    password = event.get("PASSWORD") or os.getenv("DBT_PG_PASSWORD")
    os.environ['DBT_PG_PASSWORD'] = password
    database = event.get("DATABASE") or os.getenv("DBT_PG_DATABASE")
    os.environ['DBT_PG_DATABASE'] = database
    schema = event.get("SCHEMA") or os.getenv("DBT_PG_SCHEMA")
    os.environ['DBT_PG_SCHEMA'] = schema
    print(f"Running DBT build with database: {database}, schema: {schema}")
    dbt_runner = dbtRunner()
    cli_args = ["deps"]
    result = dbt_runner.invoke(cli_args)
    if result.success:
        print("DBT deps completed successfully")
    else:
        print("DBT deps failed")
        print(result.exception)
    cli_args = ["build"]
    result = dbt_runner.invoke(cli_args)
    if result.success:
        print("DBT build completed successfully")
    else:
        print("DBT build failed")
        print(result.exception)

def main():
    """Main entry point for CLI usage."""
    handler({}, {})


if __name__ == "__main__":
    main()        
