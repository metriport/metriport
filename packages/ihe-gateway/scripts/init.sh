#!/bin/bash

# Fail on error
set -e

source ./scripts/load-env.sh

if [ -z "${CONFIG_BUCKET_NAME}" ]; then
  echo "CONFIG_BUCKET_NAME is not set, skipping downloading certs and custom extensions."
  exit 1
fi

if [[ -z "${ENV_TYPE}" ]]; then
  echo "ENV_TYPE is missing, default to staging"
  ENV_TYPE="staging"
fi

BUCKET_NAME="$CONFIG_BUCKET_NAME-$ENV_TYPE"

echo "Pulling config from $BUCKET_NAME"

aws s3 sync s3://$BUCKET_NAME/ihe-gateway/config/certs ./config/certs --delete

aws s3 sync s3://$BUCKET_NAME/ihe-gateway/config/custom-extensions ./config/custom-extensions --delete
