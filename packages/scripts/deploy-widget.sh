#!/usr/bin/env bash

if [[ -z "${AWS_REGION}" ]]; then
  echo "AWS_REGION is missing"
  exit 1
fi
if [[ -z "${S3_BUCKET}" ]]; then
  echo "S3_BUCKET is missing"
  exit 1
fi
if [[ -z "${CF_DISTRIB_ID}" ]]; then
  echo "CF_DISTRIB_ID is missing"
  exit 1
fi

pushd packages/connect-widget

# First deploy hashed files that are cached forever
# It is important to deploy these files first,
# because they are referenced by the index.html file.
# If a user attempts to download a hashed file that doesn't exist,
# it can cause a bad cache entry in CloudFront.

aws s3 cp build/ "s3://${S3_BUCKET}/" \
  --region "$AWS_REGION" \
  --recursive \
  --cache-control "public, max-age=31536000" \
  --exclude "*.html" \
  --exclude "asset-manifest.json" \
  --include "*"

# Now deploy named files that are not cached.
# These are small lightweight files that are not hashed.
# It is important to deploy these files last,
# because they reference the previously uploaded hashed files.

aws s3 cp build/ "s3://${S3_BUCKET}/" \
  --region "$AWS_REGION" \
  --recursive \
  --cache-control "no-cache" \
  --exclude "*" \
  --include "asset-manifest.json"

aws s3 cp build/ "s3://${S3_BUCKET}/" \
  --region "$AWS_REGION" \
  --recursive \
  --cache-control "no-cache" \
  --exclude "*" \
  --include "*.html"

# Invalidate the CloudFront cache so that the
# new files are served immediately to users

aws cloudfront create-invalidation \
  --no-cli-pager \
  --region "$AWS_REGION" \
  --distribution-id ${CF_DISTRIB_ID} \
  --paths "/*"

popd
