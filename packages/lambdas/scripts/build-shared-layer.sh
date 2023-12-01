#!/bin/bash

addPackageToLayer() {
   package=$1
   package_folder="../$package"
   package_on_layer="./layers/shared/nodejs/node_modules/@metriport/$package"
   echo "Copying $package_folder to shared layer..."
   mkdir $package_on_layer
   cp $package_folder/package.json $package_on_layer
   rsync -a $package_folder/dist $package_on_layer --exclude *.ts --exclude *.ts.map --exclude __tests__
}

main() {
   mkdir -p ./layers/shared/nodejs

   echo "Copying lambdas dependencies to shared layer..."
   cp -r node_modules ./layers/shared/nodejs/

   addPackageToLayer "shared"
   addPackageToLayer "core"

   pushd ./layers/shared

   echo "Zipping shared layer..."
   zip -rq shared-layer.zip ./nodejs

   popd

   echo "Done!"
}

main
