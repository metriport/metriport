#!/bin/bash
INPUT_DATABASE="${DBT_PG_DATABASE}"
INPUT_SCHEMA="${DBT_PG_SCHEMA}"
dbt build --vars "{"input_database": "$INPUT_DATABASE", "input_schema": "$INPUT_SCHEMA"}"