#!/bin/bash

main() {
   mkdir -p ./layers/shared/nodejs

   cp -r node_modules ./layers/shared/nodejs/

   core="../core"
   core_on_layer="./layers/shared/nodejs/node_modules/@metriport/core"
   # TODO 1148 this can become a function when we want to move all lambda dependencies to local packages to local filesystem instead of NPM
   mkdir $core_on_layer
   cp $core/package.json $core_on_layer
   rsync -a $core/dist $core_on_layer --exclude __tests__

   pushd ./layers/shared

   zip -rq shared-layer.zip ./nodejs

   popd

   echo "Done!"
}

main
