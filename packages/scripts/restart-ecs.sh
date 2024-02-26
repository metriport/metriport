#!/usr/bin/env bash

# Run from the root of the repository.

if [[ -z "${AWS_REGION}" ]]; then
  echo "AWS_REGION is missing"
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

# Update the fargate service
aws ecs update-service \
  --no-cli-pager \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --force-new-deployment

# Wait for the service to be stable
until aws ecs wait services-stable --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE"
do
    echo "'aws ecs wait services-stable' timed out, trying again in 5s..."
    sleep 5
done
echo -e "Done."