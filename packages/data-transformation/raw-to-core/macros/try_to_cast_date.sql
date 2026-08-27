{#

    This macros takes in a date column and date format (defaults to 'YYYY-MM-DD')
    then runs a try to cast macro based on the adapter type. Returns NULL
    if the input is NULL, empty string, or an invalid date format.

#}

{%- macro try_to_cast_date(column_name, date_format='YYYY-MM-DD') -%}

    {{ return(adapter.dispatch('try_to_cast_date')(column_name, date_format)) }}

{%- endmacro -%}

{%- macro default__try_to_cast_date(column_name, date_format) -%}

    try_cast(nullif({{ column_name }}, '') as date)

{%- endmacro -%}

{%- macro postgres__try_to_cast_date(column_name, date_format) -%}

    {%- if date_format == 'YYYY-MM-DD' -%}
    case
      when nullif({{ column_name }}, '') is null then null
      when {{ column_name }} similar to '[0-9]{4}-[0-9]{2}-[0-9]{2}%'
      then to_date(substring({{ column_name }} from 1 for 10),'{{date_format}}')
      else null
    end
    {%- elif date_format == 'YYYYMMDD' -%}
    case
      when nullif({{ column_name }}, '') is null then null
      when {{ column_name }} similar to '[0-9]{4}[0-9]{2}[0-9]{2}%'
      then to_date(substring({{ column_name }} from 1 for 8), '{{date_format}}')
      else null
    end
    {%- elif date_format == 'MM/DD/YYYY' -%}
    case
      when nullif({{ column_name }}, '') is null then null
      when {{ column_name }} similar to '[0-9]{2}/[0-9]{2}/[0-9]{4}%'
      then to_date(substring({{ column_name }} from 1 for 10), '{{date_format}}')
      else null
    end
    {%- elif date_format == 'YYYY-MM-DD HH:MI:SS' -%}
    case
      when nullif({{ column_name }}, '') is null then null
      when {{ column_name }} similar to '[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}%'
      then to_date(substring({{ column_name }} from 1 for 10), '{{date_format}}')
      else null
    end
    {%- elif date_format == 'YYYY-MM-DDTHH:MI:SS' -%}
    case
      when nullif({{ column_name }}, '') is null then null
      when {{ column_name }} similar to '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}%'
      then to_date(substring({{ column_name }} from 1 for 10), '{{date_format}}')
      else null
    end
    {%- else -%}
    null
    {%- endif -%}

{%- endmacro -%}

{%- macro snowflake__try_to_cast_date(column_name, date_format) -%}

    try_cast(nullif({{ column_name }}, '') as date)

{%- endmacro -%}
