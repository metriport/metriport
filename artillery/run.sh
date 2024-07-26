#!/bin/bash

#log every command
set -x

# EXISTING

artillery run --output report_existing_findOrCreate.json artillery-existing-findOrCreate.yml
artillery report report_existing_findOrCreate.json 
sleep 2

artillery run --output report_existing_insertOrSelect.json artillery-existing-insertOrSelect.yml
artillery report report_existing_insertOrSelect.json 
sleep 2

artillery run --output report_existing_insert.json artillery-existing-insert.yml
artillery report report_existing_insert.json 
sleep 2

# NEW

artillery run --output report_new_findOrCreate.json artillery-new-findOrCreate.yml
artillery report report_new_findOrCreate.json 
sleep 2

artillery run --output report_new_insertOrSelect.json artillery-new-insertOrSelect.yml
artillery report report_new_insertOrSelect.json 
sleep 2

artillery run --output report_new_insert.json artillery-new-insert.yml
artillery report report_new_insert.json 
sleep 2
