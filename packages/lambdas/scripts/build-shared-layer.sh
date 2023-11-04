#!/bin/bash

main() {
   mkdir -p ./layers/shared/nodejs

   echo "Copying lambdas dependencies to shared layer..."
   cp -r node_modules ./layers/shared/nodejs/

   core="../core"
   core_on_layer="./layers/shared/nodejs/node_modules/@metriport/core"
   echo "Copying $core to shared layer..."
   # TODO 1148 this can become a function when we want to move all lambda dependencies to local packages to local filesystem instead of NPM
   mkdir $core_on_layer
   cp $core/package.json $core_on_layer
   rsync -a $core/dist $core_on_layer --exclude *.ts --exclude *.ts.map --exclude __tests__

   pushd ./layers/shared

   echo "Zipping shared layer..."
   zip -rq shared-layer.zip ./nodejs

   popd

   echo "Done!"
}

main
