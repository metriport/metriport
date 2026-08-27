{% macro get_inline_extension(
    base_alias,
    target_url,
    max_index,
    value_field,
    system_filter_url,
    system_filter_column
) %}
    {#-
    Generates an inline COALESCE with CASE statements that checks each extension index directly.
    Returns the first matching extension value for the target URL.
    COALESCE short-circuits: stops evaluating once first non-null value is found (early exit).
    
    Args:
        base_alias: Alias of the base table (e.g., 'c')
        target_url: The extension URL to match (e.g., 'condition-chronicity.json')
        max_index: Maximum extension index to check (0-based, so max_index=9 checks 0-9)
        value_field: Field to return ('valuestring', 'valuecoding_code', 'valuecodeableconcept_coding_0_code', etc.)
        system_filter_url: Optional system URL to filter by (e.g., 'condition-chronicity.json' for chronicity)
        system_filter_column: Column to check for system filter (e.g., 'valuecoding_system')
    -#}
    {#- COALESCE short-circuits: PostgreSQL stops evaluating once first non-null is found -#}
    coalesce(
        {% for i in range(max_index + 1) %}
        case 
            when {{ base_alias }}.extension_{{ i }}_url = '{{ target_url }}'
                {% if system_filter_url is not none and system_filter_column is not none %}
                    and {{ base_alias }}.extension_{{ i }}_{{ system_filter_column }} = '{{ system_filter_url }}'
                {% endif %}
                and {{ base_alias }}.extension_{{ i }}_{{ value_field }} is not null
                and {{ base_alias }}.extension_{{ i }}_{{ value_field }} != ''
            then {{ base_alias }}.extension_{{ i }}_{{ value_field }}
        end{% if not loop.last %},{% endif %}
        {% endfor %}
    )
{% endmacro %}
