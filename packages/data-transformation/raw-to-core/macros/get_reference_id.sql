{% macro get_reference_id(reference_value) %}
    {#-
    Extracts the reference ID (last 36 characters) from a FHIR reference value.
    
    Args:
        reference_value: The full reference value (e.g., 'Patient/123e4567-e89b-12d3-a456-426614174000')
    
    Returns:
        The last 36 characters (UUID) from the reference value
    -#}
    right({{ reference_value }}, 36)
{% endmacro %}
