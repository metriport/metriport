#!/bin/bash
INPUT_DATABASE="test"
if [ "$DBT_TARGET" = "production" ]; then
    echo "Setting input database for customer $CX_ID in production..."
    INPUT_DATABASE="PRODUCTION_METRICS_${CX_ID}"
elif [ "$DBT_TARGET" = "staging" ]; then
    echo "Setting input database for customer $CX_ID in staging..." 
    INPUT_DATABASE="STAGING_METRICS_${CX_ID}"
else
    echo "Setting input database for customer $CX_ID in development..."
    INPUT_DATABASE="DEVELOPMENT_METRICS_${CX_ID}"
fi
dbt build --vars "input_database: $INPUT_DATABASE"