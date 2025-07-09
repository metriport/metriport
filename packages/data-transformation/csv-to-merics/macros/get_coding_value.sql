-- creates blocks that look like this:
-- get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'code')
-- COALESCE(
--     CASE WHEN code_coding_0_system = 'http://www.nlm.nih.gov/research/umls/rxnorm' THEN code_coding_0_code END,
--     CASE WHEN code_coding_1_system = 'http://www.nlm.nih.gov/research/umls/rxnorm' THEN code_coding_1_code END,
--     CASE WHEN code_coding_2_system = 'http://www.nlm.nih.gov/research/umls/rxnorm' THEN code_coding_2_code END,
--     CASE WHEN code_coding_3_system = 'http://www.nlm.nih.gov/research/umls/rxnorm' THEN code_coding_3_code END,
--     CASE WHEN code_coding_4_system = 'http://www.nlm.nih.gov/research/umls/rxnorm' THEN code_coding_4_code END,
--     CASE WHEN code_coding_5_system = 'http://www.nlm.nih.gov/research/umls/rxnorm' THEN code_coding_5_code END,
--     CASE WHEN code_coding_6_system = 'http://www.nlm.nih.gov/research/umls/rxnorm' THEN code_coding_6_code END,
--     CASE WHEN code_coding_7_system = 'http://www.nlm.nih.gov/research/umls/rxnorm' THEN code_coding_7_code END,
--     CASE WHEN code_coding_8_system = 'http://www.nlm.nih.gov/research/umls/rxnorm' THEN code_coding_8_code END
-- ) as rxnorm_code,

{% macro get_coding_value(system_url, field_type, max_index=5) %}
    COALESCE(
        {% for i in range(max_index + 1) %}
        CASE WHEN code_coding_{{i}}_system = '{{system_url}}' 
             THEN code_coding_{{i}}_{{field_type}} END
        {% if not loop.last %},{% endif %}
        {% endfor %}
    )
{% endmacro %} 