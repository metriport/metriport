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

# Fail on error
set -e

# Echo commands
set -x

aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI

GITHUB_SHA=$(git rev-parse --short HEAD)

API_FOLDER=packages/api
TARBALL_NAME=metriport-api.tar.gz
API_TARBALL=$API_FOLDER/$TARBALL_NAME

rm -rf ${API_TARBALL}

# Build server tarball
tar \
  --exclude='**/*.ts' \
  --exclude='**/__tests__' \
  --exclude='**/*.spec*' \
  --exclude='**/*.test*' \
  --exclude="**/${TARBALL_NAME}" \
  -czf ${API_TARBALL} \
  package.json \
  package-lock.json \
  packages/shared/package.json \
  packages/shared/dist \
  packages/core/package.json \
  packages/core/dist \
  packages/api-sdk/package.json \
  packages/api-sdk/dist \
  packages/commonwell-sdk/package.json \
  packages/commonwell-sdk/dist \
  packages/carequality-sdk/package.json \
  packages/carequality-sdk/dist \
  packages/ihe-gateway-sdk/package.json \
  packages/ihe-gateway-sdk/dist \
  ${API_FOLDER}/package.json \
  ${API_FOLDER}/dist

pushd ${API_FOLDER}

# Build and push Docker images
docker buildx build \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  --tag "$ECR_REPO_URI:latest" \
  --tag "$ECR_REPO_URI:$GITHUB_SHA" \
  --push \
  .

popd

# Build and push Docker images
source ./packages/scripts/restart-api.sh