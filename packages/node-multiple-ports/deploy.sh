#!/usr/bin/env bash

# Run from the root of the repository.

AWS_REGION="us-west-1"
ECR_REPO_URI="463519787594.dkr.ecr.us-west-1.amazonaws.com/metriport/ihe-gateway"
ECS_CLUSTER="IHEStack-IHEGatewayClusterA7D9B464-O0YKSVeILdSi"
IHE_OUTBOUND_ECS_SERVICE="IHEStack-IHEGatewayOutboundFargateService64CBCB18-s0a924Lki3Be"
IHE_INBOUND_ECS_SERVICE="IHEStack-IHEGatewayInboundFargateService4393BE41-ksKDv5k5owRh"

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

echo "Logging into ECR/Docker"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI

GITHUB_SHA=$(git rev-parse --short HEAD)

echo "Building and pushing Docker image"
docker buildx build \
  --platform linux/amd64 \
  --tag "$ECR_REPO_URI:latest" \
  --tag "$ECR_REPO_URI:$GITHUB_SHA" \
  --push \
  .

# TODO consider using the same approach from packages/ihe-gateway/scripts/push-to-cloud.sh to restart the services

echo "Restarting the IHE GW service $IHE_INBOUND_ECS_SERVICE"
# Update the fargate service
aws ecs update-service \
  --no-cli-pager \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --service "$IHE_INBOUND_ECS_SERVICE" \
  --force-new-deployment

echo "Restarting the IHE GW service $IHE_OUTBOUND_ECS_SERVICE"
# Update the fargate service
aws ecs update-service \
  --no-cli-pager \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --service "$IHE_OUTBOUND_ECS_SERVICE" \
  --force-new-deployment