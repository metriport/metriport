#!/bin/bash

addPackageToLayer() {
   package=$1
   package_folder="../$package"
   package_on_layer="./layers/shared/nodejs/node_modules/@metriport/$package"
   echo "Copying $package_folder to shared layer..."

   mkdir -p $package_on_layer
   cp $package_folder/package.json $package_on_layer
   rsync -a --exclude *.ts --exclude *.d.ts --exclude *.ts.map --exclude *.js.map --exclude __tests__ --exclude *.md --exclude LICENSE  $package_folder/dist $package_on_layer
}

main() {
   mkdir -p ./layers/shared/nodejs

   echo "Copying lambdas dependencies to shared layer..."
   rsync -a --exclude *.ts --exclude *.d.ts --exclude *.ts.map --exclude *.js.map --exclude __tests__ --exclude *.md --exclude LICENSE node_modules ./layers/shared/nodejs/

   addPackageToLayer "shared"
   addPackageToLayer "core"
   addPackageToLayer "ihe-gateway-sdk"
   addPackageToLayer "fhir-converter"

   pushd ./layers/shared

   echo "Zipping shared layer..."
   zip -rq shared-layer.zip ./nodejs

   popd

   echo "Done!"
}

main
