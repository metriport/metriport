This package is used to transform CSV data to metrics.

## Prerequisites

- Docker
- Docker Compose

## Environment Variables

```bash
PROFILE={snowflake | postgres}
DBT_SNOWFLAKE_ACCOUNT=
DBT_SNOWFLAKE_DATABASE=
DBT_SNOWFLAKE_PASSWORD=
DBT_SNOWFLAKE_SCHEMA=
DBT_SNOWFLAKE_USER=
DBT_SNOWFLAKE_WAREHOUSE=
DBT_PG_HOST=
DBT_PG_PORT=
DBT_PG_USER=
DBT_PG_PASSWORD=
DBT_PG_DATABASE=
DBT_PG_SCHEMA=
DBT_PG_THREADS=1
```

Example `.env` files:

```bash
PROFILE=snowflake
DBT_SNOWFLAKE_ACCOUNT=1234567890
DBT_SNOWFLAKE_DATABASE=test_db
DBT_SNOWFLAKE_PASSWORD=password
DBT_SNOWFLAKE_SCHEMA=test_schema
DBT_SNOWFLAKE_USER=user
DBT_SNOWFLAKE_WAREHOUSE=test_warehouse
```

```bash
PROFILE=postgres
DBT_PG_HOST=localhost
DBT_PG_PORT=5432
DBT_PG_USER=postgres
DBT_PG_PASSWORD=password
DBT_PG_DATABASE=test_db
DBT_PG_SCHEMA=test_schema
DBT_PG_THREADS=1
```

## Usage

```bash
docker-compose up --build
```

## Aurora reader/writer (production) – FDW

dbt connects to the **Writer** only. Raw reads are offloaded to the **Reader** (replica) using PostgreSQL [Foreign Data Wrapper (FDW)](https://www.postgresql.org/docs/current/postgres-fdw.html):

1. **FDW setup**: Done by core’s create-fhir-tables flow, which creates a foreign server and schema `raw_fdw` with foreign tables mirroring the reader’s `raw` schema.
2. **dbt**: The raw source reads from `input_schema`. Set `input_schema` to `raw_fdw` when using FDW (e.g. pass `SCHEMA=raw_fdw` or `DBT_PG_SCHEMA=raw_fdw` so that the raw source hits the FDW). Stage/core materializations write locally on the Writer.
3. **Result**: Heavy raw scans run on the replica; the writer only handles the result transfer and INSERTs into stage/core.

## Configuration

The configuration is done in the `docker-compose.yml` file.

## Running the server

```bash
docker-compose -f docker-compose.server.yml up --build
```
