This package is used to transform consolidated FHIR Bundles to flattened CSV files in S3.

## Usage

This package supports three deployment modes:

### 1. CLI Mode (Local Development)

Run the transformation as a one-time CLI command:

```bash
# Using the startup script
./start.sh cli

# Or directly with docker-compose
docker-compose up --build
```

### 2. HTTP Server Mode (Local Development)

Run as an HTTP server that can receive transformation requests:

```bash
# Using the startup script
./start.sh server

# Or directly with docker-compose
docker-compose -f docker-compose.server.yml up --build
```

The HTTP server will be available at `http://localhost:8001` with the following endpoints:

- `GET /health` - Health check
- `POST /transform` - Transform FHIR data to CSV

#### Required body parameters for the /transform endpoint

- `CX_ID`: Customer ID
- `PATIENT_ID`: Patient ID
- `INPUT_S3_BUCKET`: S3 bucket containing the input FHIR bundle
- `OUTPUT_S3_BUCKET`: S3 bucket where CSV files will be uploaded
- `OUTPUT_PREFIX`: Prefix for the output file keys in S3

Example request to the transform endpoint:

```bash
curl -X POST http://localhost:8001/transform \
  -H "Content-Type: application/json" \
  -d '{
    "CX_ID": "customer_id",
    "PATIENT_ID": "patient_id",
    "INPUT_S3_BUCKET": "input_bucket",
    "OUTPUT_S3_BUCKET": "output_bucket",
    "OUTPUT_PREFIX": "output_prefix"
  }'
```

### 3. Lambda Mode (Cloud Deployment)

Deployed as an AWS Lambda function using the `Dockerfile.lambda`.

## Configuration

### CLI Mode

Configuration is done in the `docker-compose.yml` file and `.env` files.

### HTTP Server Mode

Configuration is done in the `docker-compose.server.yml` file. The server accepts all parameters via HTTP requests rather than environment variables, making it easier to test different configurations without modifying environment files.

### Factory Pattern Integration

The TypeScript factory pattern in `packages/core` automatically selects the appropriate implementation:

- **Cloud**: Uses `FhirToCsvTransformCloud` (Lambda invocation)
- **Local with HTTP**: Uses `FhirToCsvTransformHttp` (HTTP requests) when `FHIR_TO_CSV_USE_HTTP=true`
- **Local CLI**: Uses `FhirToCsvTransformDirect` (direct Lambda invocation) by default

To use HTTP mode from the API, set the environment variable:

```bash
export FHIR_TO_CSV_USE_HTTP=true
export FHIR_TO_CSV_TRANSFORM_HTTP_ENDPOINT=http://localhost:8001
```
