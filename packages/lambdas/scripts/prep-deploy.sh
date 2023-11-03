#!/bin/bash

main() {
   # Clean so we don't have test files on the node_modules that will be copied to the layer
   npm run clean
   npm ci --omit=dev --ignore-scripts --no-fund
   ./scripts/build-shared-layer.sh
   # Reinstall WITH dev dependencies so the compilation works - the regular code imports from layers,
   # so part of the code is available without being installed through `npm install`.
   npm ci --ignore-scripts --no-fund
   # Rebuild so ./dist is available to CDK through packages/infra
   npm run build:cloud

   pushd layers/playwright
   npm run prep-deploy
   popd
}

main
