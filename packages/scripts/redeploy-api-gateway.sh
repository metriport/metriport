#!/usr/bin/env bash

# Run from the root of the repository.

if [[ -z "${AWS_REGION}" ]]; then
  echo "AWS_REGION is missing"
  exit 1
fi
if [[ -z "${API_GW_ID}" ]]; then
  echo "API_GW_ID is missing"
  exit 1
fi

# Fail on error
set -e

# Echo commands
set -x

aws apigateway create-deployment \
  --region $AWS_REGION \
  --rest-api-id $API_GW_ID \
  --stage-name prod \
  --no-cli-pager

echo -e "Done."