{#

    This macros takes in a date column and date format (defaults to 'YYYY-MM-DD')
    then runs a try to cast macro based on the adapter type. Returns NULL
    casted as date if the try to cast fails.

#}

{%- macro try_to_cast_date(column_name, date_format='YYYY-MM-DD') -%}

    {{ return(adapter.dispatch('try_to_cast_date')(column_name, date_format)) }}

{%- endmacro -%}

{%- macro default__try_to_cast_date(column_name, date_format) -%}

    try_cast( {{ column_name }} as date )

{%- endmacro -%}

{%- macro postgres__try_to_cast_date(column_name, date_format) -%}

    {%- if date_format == 'YYYY-MM-DD' -%}
    case
      when {{ column_name }} similar to '[0-9]{4}-[0-9]{2}-[0-9]{2}'
      then to_date( {{ column_name }}, 'YYYY-MM-DD')
      else date(NULL)
    end
    {%- elif date_format == 'YYYYMMDD' -%}
    case
      when {{ column_name }} similar to '[0-9]{4}[0-9]{2}[0-9]{2}'
      then to_date( {{ column_name }}, 'YYYYMMDD')
      else date(NULL)
    end
    {%- elif date_format == 'MM/DD/YYYY' -%}
    case
      when {{ column_name }} similar to '[0-9]{2}/[0-9]{2}/[0-9]{4}'
      then to_date( {{ column_name }}, 'MM/DD/YYYY')
      else date(NULL)
    end
    {%- elif date_format == 'YYYY-MM-DD HH:MI:SS' -%}
    case
      when {{ column_name }} similar to '[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}'
      then to_date( {{ column_name }}, 'YYYY-MM-DD HH:MI:SS')
      else date(NULL)
    end
    {%- else -%}
    date(NULL)
    {%- endif -%}

{%- endmacro -%}

{%- macro snowflake__try_to_cast_date(column_name, date_format) -%}

    try_cast( {{ column_name }} as date )

{%- endmacro -%}

{%- macro athena__try_to_cast_date(column_name, date_format) -%}

    (case
        when typeof({{ column_name }}) = 'date' then date({{ column_name }})
        else try_cast(substring(try_cast({{ column_name }} as varchar), 1, 10) as date)
    end)

{%- endmacro -%}
