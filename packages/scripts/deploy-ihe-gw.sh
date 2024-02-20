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
if [[ -z "${ECS_SERVICE1}" ]]; then
  echo "ECS_SERVICE1 is missing"
  exit 1
fi
if [[ -z "${ECS_SERVICE2}" ]]; then
  echo "ECS_SERVICE2 is missing"
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
source ./scripts/load-env.sh

echo "Building Docker dependencies"
source ./scripts/build-docker-dependencies.sh

echo "Building and pushing Docker image"
# TODO 1377 Try to remove '--platform' or keep it to one value
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

# TODO 1377 Split restart from wait and wait in parallel”’
echo "Restarting the IHE GW service $ECS_SERVICE1"
# Update the fargate service
aws ecs update-service \
  --no-cli-pager \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE1" \
  --force-new-deployment

echo "Restarting the IHE GW service $ECS_SERVICE2"
# Update the fargate service
aws ecs update-service \
  --no-cli-pager \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE2" \
  --force-new-deployment


echo "Waiting for services to be healthy/stable..."
# Wait for the service to be stable
until ( aws ecs wait services-stable --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE1" && \
        aws ecs wait services-stable --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE2" )
do
    echo "'aws ecs wait services-stable' timed out, trying again in 5s..."
    sleep 5
done
echo -e "Done."