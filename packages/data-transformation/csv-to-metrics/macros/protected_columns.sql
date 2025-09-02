{% macro protected_columns(column_name) %}
    {%- set adapter_type = target.type -%}

    {%- if adapter_type == 'bigquery' -%}
        `{{ column_name }}`
    {%- elif adapter_type in ['snowflake', 'redshift'] -%}
        "{{ column_name }}"
    {%- else -%}
        {{ column_name }} -- Fallback, no quotes
    {%- endif -%}
{% endmacro %}