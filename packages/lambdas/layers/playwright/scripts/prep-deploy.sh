#!/bin/bash

main() {
   npm ci --omit=dev --ignore-scripts --no-fund

   mkdir -p ./dist/nodejs

   cp -r node_modules ./dist/nodejs/

   pushd ./dist

   zip -r playwright-layer.zip ./nodejs popd
}

main
