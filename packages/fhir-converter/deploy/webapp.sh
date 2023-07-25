#!/bin/bash

# symlink for web app persistence
mkdir -p /home/fhirconvertertemplates
ln -snf /home/fhirconvertertemplates /usr/src/app/src/service-templates

npm start
