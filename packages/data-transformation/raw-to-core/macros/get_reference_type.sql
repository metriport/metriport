{% macro get_reference_type(reference_value) %}
    {#-
    Extracts the reference type from a FHIR reference value by removing the ID portion.
    
    Args:
        reference_value: The full reference value (e.g., 'Patient/123e4567-e89b-12d3-a456-426614174000')
    
    Returns:
        The reference type (e.g., 'Patient') or the full value if no '/' is present
    -#}
    case
        when position('/' in {{ reference_value }}) > 0 then
            left({{ reference_value }}, position('/' in {{ reference_value }}) - 1)
        else {{ reference_value }}
    end
{% endmacro %}
