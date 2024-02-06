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

# Fail on error
set -e

# Echo commands
set -x

aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI

GITHUB_SHA=$(git rev-parse --short HEAD)

FOLDER=packages/ihe-gateway

pushd ${FOLDER}

./scripts/init.sh

source ./scripts/load-env.sh strict

source ./scripts/build-docker-dependencies.sh

# Build and push Docker images
docker buildx build \
  --build-arg "ARTIFACT=$IHE_GW_ARTIFACT_URL" \
  --build-arg "KEYSTORENAME=$IHE_GW_KEYSTORENAME" \
  --build-arg "ZULUKEY=$IHE_GW_ZULUKEY" \
  --secret "id=store_pass,type=file,src=store-pass.secret" \
  --secret "id=keystore_pass,type=file,src=keystore-pass.secret" \
  --secret "id=mirth_properties,type=file,src=secret.properties" \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  --tag "$ECR_REPO_URI:latest" \
  --tag "$ECR_REPO_URI:$GITHUB_SHA" \
  --push \
  .

popd

# TODO 1377
# TODO 1377
# TODO 1377
# TODO 1377
# Restart the server so it loads using the new image
# source ./packages/scripts/restart-api.sh
