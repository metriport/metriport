#!/bin/bash
INPUT_DATABASE="${DBT_TUVA_CI_DATABASE}"
INPUT_SCHEMA="${DBT_SNOWFLAKE_CI_SCHEMA}"
dbt build --vars "{"input_database": "$INPUT_DATABASE", "input_schema": "$INPUT_SCHEMA"}"