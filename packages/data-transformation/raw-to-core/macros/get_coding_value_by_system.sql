{% macro get_coding_value_by_system(system_url, field_type, max_index=5) %}
    COALESCE(
        {% for i in range(max_index + 1) %}
        CASE WHEN code_coding_{{i}}_system = '{{system_url}}' 
             THEN code_coding_{{i}}_{{field_type}} END
        {% if not loop.last %},{% endif %}
        {% endfor %}
    )
{% endmacro %}

-- get_coding_value('fake-system', 'code', 5)
-- COALESCE(
--     CASE WHEN code_coding_0_system = 'fake-system' THEN code_coding_0_code END,
--     CASE WHEN code_coding_1_system = 'fake-system' THEN code_coding_1_code END,
--     CASE WHEN code_coding_2_system = 'fake-system' THEN code_coding_2_code END,
--     CASE WHEN code_coding_3_system = 'fake-system' THEN code_coding_3_code END,
--     CASE WHEN code_coding_4_system = 'fake-system' THEN code_coding_4_code END,
--     CASE WHEN code_coding_5_system = 'fake-system' THEN code_coding_5_code END
-- ) as fake_system_code
