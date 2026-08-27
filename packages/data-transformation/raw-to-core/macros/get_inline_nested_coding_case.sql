{% macro get_inline_nested_coding_case(
    base_alias,
    coding_prefix,
    target_system,
    max_index,
    secondary_max_index,
    field_type
) %}
    {#-
    Generates an inline COALESCE with CASE statements for nested coding structures (e.g., category_i_coding_j).
    Checks each combination of i and j indices directly.
    COALESCE short-circuits: stops evaluating once first non-null value is found (early exit).
    
    Args:
        base_alias: Alias of the base table (e.g., 'o')
        coding_prefix: Prefix for the coding columns (e.g., 'category' for category_i_coding_j)
        target_system: The target system to match (e.g., 'http://terminology.hl7.org/CodeSystem/observation-category')
        max_index: Maximum primary index (i) to check (0-based)
        secondary_max_index: Maximum secondary index (j) to check (0-based)
        field_type: Field to return ('code' or 'display')
    -#}
    {#- COALESCE short-circuits: PostgreSQL stops evaluating once first non-null is found -#}
    coalesce(
        {% for i in range(max_index + 1) %}
        {% for j in range(secondary_max_index + 1) %}
        case
            when (
                {% if target_system == 'http://terminology.hl7.org/CodeSystem/condition-category' %}
                    {{ base_alias }}.{{ coding_prefix }}_{{ i }}_coding_{{ j }}_system ilike '%condition-category'
                {% elif target_system == 'http://terminology.hl7.org/CodeSystem/observation-category' %}
                    {{ base_alias }}.{{ coding_prefix }}_{{ i }}_coding_{{ j }}_system ilike '%observation-category'
                {% elif target_system == 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation' %}
                    {{ base_alias }}.{{ coding_prefix }}_{{ i }}_coding_{{ j }}_system ilike '%ObservationInterpretation'
                {% elif target_system == 'http://terminology.hl7.org/CodeSystem/encounter-type' %}
                    {{ base_alias }}.{{ coding_prefix }}_{{ i }}_coding_{{ j }}_system ilike '%encounter-type'
                {% elif target_system == 'http://terminology.hl7.org/CodeSystem/discharge-disposition' %}
                    {{ base_alias }}.{{ coding_prefix }}_{{ i }}_coding_{{ j }}_system ilike '%discharge-disposition'
                {% elif target_system == 'http://snomed.info/sct' %}
                    {{ base_alias }}.{{ coding_prefix }}_{{ i }}_coding_{{ j }}_system ilike '%snomed%'
                {% elif target_system == 'http://terminology.hl7.org/CodeSystem/v2-0074' %}
                    {{ base_alias }}.{{ coding_prefix }}_{{ i }}_coding_{{ j }}_system ilike '%v2-0074%'
                {% else %}
                    {{ base_alias }}.{{ coding_prefix }}_{{ i }}_coding_{{ j }}_system = '{{ target_system }}'
                {% endif %}
            )
            and {{ base_alias }}.{{ coding_prefix }}_{{ i }}_coding_{{ j }}_code is not null
            and {{ base_alias }}.{{ coding_prefix }}_{{ i }}_coding_{{ j }}_code != ''
            then {{ base_alias }}.{{ coding_prefix }}_{{ i }}_coding_{{ j }}_{{ field_type }}
        end{% if not (i == max_index and j == secondary_max_index) %},{% endif %}
        {% endfor %}
        {% endfor %}
    )
{% endmacro %}
