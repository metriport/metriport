{#

    This macros takes in a datetime column and then runs a try to cast macro
    based on the adapter type. Returns NULL if the input is NULL, empty string,
    or an invalid datetime format.

    Supports FHIR datetime formats including:
    - 2024-01-01T12:34:56Z
    - 2024-01-01T12:34:56.789Z
    - 2024-01-01T12:34:56+05:00
    - 2024-01-01T12:34:56.789-05:00
    - 2024-01-01 12:34:56
    - 2024-01-01

#}

{%- macro try_to_cast_datetime(column_name) -%}

    {{ return(adapter.dispatch('try_to_cast_datetime')(column_name)) }}

{%- endmacro -%}

{%- macro default__try_to_cast_datetime(column_name) -%}

    try_cast(nullif({{ column_name }}, '') as timestamp)

{%- endmacro -%}

{%- macro postgres__try_to_cast_datetime(column_name) -%}
    {# Optimized: Use faster regex ~ operator and minimize format checks #}
    {# Normalize fractional seconds to 6 digits (microseconds): right-pad so .123 -> 123000 us = 123 ms #}
    case
        when nullif({{ column_name }}, '') is null then null
        {# Fast pre-check: Must start with YYYY-MM-DD pattern #}
        when {{ column_name }} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then
            {# Try most common formats first #}
            coalesce(
                {# ISO with Z timezone and fractional seconds - normalize fractional to 6 digits and Z to +00:00 #}
                case when {{ column_name }} ~ 'T.*\.[0-9]+Z$' 
                    then to_timestamp(
                        regexp_replace(
                            regexp_replace({{ column_name }}, '\.([0-9]+)Z$', 
                                '.' || rpad(regexp_replace({{ column_name }}, '.*\.([0-9]+)Z$', '\1'), 6, '0') || 'Z'
                            ),
                            'Z$', '+00:00'
                        ),
                        'YYYY-MM-DD"T"HH24:MI:SS.USTZH:TZM'
                    )
                end,
                {# ISO with Z timezone but no fractional seconds - normalize Z to +00:00 #}
                case when {{ column_name }} ~ 'T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$' 
                    then to_timestamp(regexp_replace({{ column_name }}, 'Z$', '+00:00'), 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM')
                end,
                {# ISO with fractional seconds and timezone offset - normalize fractional to 6 digits #}
                case when {{ column_name }} ~ 'T.*\.[0-9]+[+-][0-9]{2}:[0-9]{2}$' 
                    then to_timestamp(
                        regexp_replace({{ column_name }}, '\.([0-9]+)([+-][0-9]{2}:[0-9]{2})$', 
                            '.' || rpad(regexp_replace({{ column_name }}, '.*\.([0-9]+)([+-][0-9]{2}:[0-9]{2})$', '\1'), 6, '0') || regexp_replace({{ column_name }}, '.*\.([0-9]+)([+-][0-9]{2}:[0-9]{2})$', '\2')
                        ),
                        'YYYY-MM-DD"T"HH24:MI:SS.USTZH:TZM'
                    )
                end,
                {# ISO with T and timezone offset (no fractional) #}
                case when {{ column_name }} ~ 'T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$' 
                    then to_timestamp({{ column_name }}, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM')
                end,
                {# ISO with T and fractional seconds but no timezone - normalize fractional to 6 digits #}
                case when {{ column_name }} ~ 'T.*\.[0-9]+$' 
                    then to_timestamp(
                        regexp_replace({{ column_name }}, '\.([0-9]+)$', 
                            '.' || rpad(regexp_replace({{ column_name }}, '.*\.([0-9]+)$', '\1'), 6, '0')
                        ),
                        'YYYY-MM-DD"T"HH24:MI:SS.US'
                    )
                end,
                {# ISO with T but no fractional seconds and no timezone #}
                case when {{ column_name }} ~ 'T[0-9]{2}:[0-9]{2}:[0-9]{2}$' 
                    then to_timestamp({{ column_name }}, 'YYYY-MM-DD"T"HH24:MI:SS')
                end,
                {# Space-separated format #}
                case when {{ column_name }} ~ ' ' 
                    then to_timestamp(substring({{ column_name }} from 1 for 19), 'YYYY-MM-DD HH24:MI:SS')
                end,
                {# Date only #}
                to_timestamp({{ column_name }}, 'YYYY-MM-DD')
            )
        else null
    end
{% endmacro %}

{%- macro snowflake__try_to_cast_datetime(column_name) -%}

    try_to_timestamp(nullif(cast({{ column_name }} as string), ''))

{%- endmacro -%}
