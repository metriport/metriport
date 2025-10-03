{#

    This macros takes in a datetime column and then runs a try to cast macro
    based on the adapter type.

#}

{%- macro try_to_cast_datetime(column_name) -%}

    {{ return(adapter.dispatch('try_to_cast_datetime')(column_name)) }}

{%- endmacro -%}

{%- macro postgres__try_to_cast_datetime(column_name) -%}

    {{ dbt.safe_cast(column_name, api.Column.translate_type("timestamp")).strip() }}

{%- endmacro -%}
