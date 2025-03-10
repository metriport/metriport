#!/usr/bin/env bash

# Run from the root of the repository.

if [[ -z "${AWS_REGION}" ]]; then
  echo "AWS_REGION is missing"
  exit 1
fi
if [[ -z "${ECR_REPO_URI}" ]]; then
  echo "ECR_REPO_URI is missing"
  exit 1
fi
if [[ -z "${ECS_CLUSTER}" ]]; then
  echo "ECS_CLUSTER is missing"
  exit 1
fi
if [[ -z "${ECS_SERVICE}" ]]; then
  echo "ECS_SERVICE is missing"
  exit 1
fi

# Define extra dependencies needed for API
API_EXTRA_DEPS="packages/api-sdk/package.json \
  packages/api-sdk/dist \
  packages/commonwell-sdk/package.json \
  packages/commonwell-sdk/dist \
  packages/carequality-sdk/package.json \
  packages/carequality-sdk/dist \
  packages/ihe-gateway-sdk/package.json \
  packages/ihe-gateway-sdk/dist"

source ./packages/scripts/generate-tarball.sh api "$API_EXTRA_DEPS"
source ./packages/scripts/push-image.sh api
source ./packages/scripts/restart-ecs.sh