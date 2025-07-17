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

source ./packages/scripts/generate-tarball.sh data-transformation/fhir-to-csv
source ./packages/scripts/push-image.sh data-transformation/fhir-to-csv fhir-to-csv
