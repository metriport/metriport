{#

    This macro takes in a column name and casts it to string type,
    converting empty strings to NULL. This is a helper to fix the
    anti-pattern of using empty strings instead of NULL.

#}

{%- macro try_to_cast_string(column_name) -%}

    nullif(cast({{ column_name }} as {{ dbt.type_string() }}), '')

{%- endmacro -%}

