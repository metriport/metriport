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

# CANNOT Echo commands, sensitive information
set +x

echo "Logging into ECR/Docker"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI

GITHUB_SHA=$(git rev-parse --short HEAD)

FOLDER=packages/ihe-gateway

pushd ${FOLDER}

echo "Initializing the IHE GW repo"
./scripts/init.sh

echo "Loading environment variables"
source ./scripts/load-env.sh strict

echo "Building Docker dependencies"
source ./scripts/build-docker-dependencies.sh

echo "Building and pushing Docker image"
docker buildx build \
  --build-arg "ARTIFACT=$IHE_GW_ARTIFACT_URL" \
  --build-arg "KEYSTORENAME=$IHE_GW_KEYSTORENAME" \
  --build-arg "ZULUKEY=$IHE_GW_ZULUKEY" \
  --secret "id=store_pass,type=file,src=store_pass.secret" \
  --secret "id=keystore_pass,type=file,src=keystore_pass.secret" \
  --secret "id=license_key,type=file,src=license_key.secret" \
  --secret "id=mirth_properties,type=file,src=secret.properties" \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  --tag "$ECR_REPO_URI:latest" \
  --tag "$ECR_REPO_URI:$GITHUB_SHA" \
  --push \
  .

popd

echo "Restarting the IHE GW service"
source ./packages/scripts/restart-ecs.sh
