{% macro get_full_refresh() %}
  {#-
    Helper macro to get full_refresh as a boolean.
    Handles both string "false"/"true" and actual boolean values.
    
    Returns: true if full_refresh is true or string "true", false otherwise
  -#}
  {%- set full_refresh_val = var('full_refresh', false) -%}
  {%- if full_refresh_val == true -%}
    {{ return(true) }}
  {%- elif full_refresh_val is string and full_refresh_val.lower() == 'true' -%}
    {{ return(true) }}
  {%- else -%}
    {{ return(false) }}
  {%- endif -%}
{% endmacro %}
