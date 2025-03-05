#!/usr/bin/env bash

# Run from the root of the repository.

if [[ $# -eq 0 ]]; then
  echo "Error: Package name is required as first argument"
  echo "Usage: $0 <package-name> [extra-dependencies]"
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

aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI

PACKAGE_NAME=$1
PACKAGE_FOLDER=packages/$PACKAGE_NAME
TARBALL_NAME=metriport-$PACKAGE_NAME.tar.gz
PACKAGE_TARBALL=$PACKAGE_FOLDER/$TARBALL_NAME
EXTRA_DEPS=${2:-} # Default to empty if not provided

# Base dependencies that are always included
BASE_DEPS="package.json \
  package-lock.json \
  packages/shared/package.json \
  packages/shared/dist \
  packages/core/package.json \
  packages/core/dist \
  ${PACKAGE_FOLDER}/package.json \
  ${PACKAGE_FOLDER}/dist"

# Combine base dependencies with any extra dependencies
FINAL_DEPS="$BASE_DEPS $EXTRA_DEPS"

rm -rf ${PACKAGE_TARBALL}

# Build server tarball
tar \
  --exclude='**/*.ts' \
  --exclude='**/__tests__' \
  --exclude='**/*.spec*' \
  --exclude='**/*.test*' \
  --exclude="**/${TARBALL_NAME}" \
  -czf ${PACKAGE_TARBALL} \
  $FINAL_DEPS