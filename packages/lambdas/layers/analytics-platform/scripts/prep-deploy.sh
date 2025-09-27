#!/bin/bash

main() {
   rm -rf ./dist/*
   mkdir -p ./dist/configurations

   cp -r ../../../data-transformation/fhir-to-csv/src/parseFhir/configurations/* ./dist/configurations/

   pushd ./dist

   zip -r analytics-platform-layer.zip ./configurations
   
   popd
}

main
