#!/usr/bin/env bash

# Run from the root of the repository.

if [[ $# -eq 0 ]]; then
  echo "Error: Package name is required as first argument"
  echo "Usage: $0 <package-name>"
  exit 1
fi

if [[ -z "${AWS_REGION}" ]]; then
  echo "AWS_REGION is missing"
  exit 1
fi
if [[ -z "${ECR_REPO_URI}" ]]; then
  echo "ECR_REPO_URI is missing"
  exit 1
fi

# Fail on error
set -e

# Echo commands
set -x

GITHUB_SHA=$(git rev-parse --short HEAD)

PACKAGE_NAME=$1
PACKAGE_FOLDER=packages/$PACKAGE_NAME

TAG_PREFIX="$2-"
if [[ -z "$TAG_PREFIX" ]]; then
  TAG_PREFIX=""
fi

pushd ${PACKAGE_FOLDER}

# Build and push Docker images
docker buildx build \
  --platform linux/amd64 \
  --tag "$ECR_REPO_URI:${TAG_PREFIX}latest" \
  --tag "$ECR_REPO_URI:$GITHUB_SHA" \
  --push \
  .

popd
