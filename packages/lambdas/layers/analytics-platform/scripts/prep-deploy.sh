#!/bin/bash

set -e

main() {
   rm -rf ./dist/*

   mkdir -p ./dist/configurations
   cp -r ../../../data-transformation/fhir-to-csv/src/parseFhir/configurations/* ./dist/configurations/

   npm ci --omit=dev --ignore-scripts --no-fund
   mkdir -p ./dist/nodejs
   cp -r node_modules ./dist/nodejs/

   pushd ./dist

   zip -r analytics-platform-layer.zip ./configurations ./nodejs
   
   popd
}

main
