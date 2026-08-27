{#

    This macro returns a SQL expression that extracts the value from the
    data-source extension by checking extension indices 0 through max_index.
    Checks for valueCoding.code first, then falls back to valueString.
    Returns NULL if not found or if empty string.

#}

{%- macro get_inline_demographic_source(max_index=4) -%}
    nullif(cast(coalesce(
        {%- for i in range(max_index + 1) -%}
        case when extension_{{i}}_url = 'https://public.metriport.com/fhir/StructureDefinition/data-source.json' then coalesce(extension_{{i}}_valuecoding_code, extension_{{i}}_valuestring) end{% if not loop.last %},{% endif %}
        {%- endfor -%}
    ) as {{ dbt.type_string() }}), '')
{%- endmacro -%}
