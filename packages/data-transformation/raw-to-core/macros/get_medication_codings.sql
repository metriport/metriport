{% macro get_medication_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select 
            id as medication_id
        ,   code_coding_{{i}}_code as code
        ,   case 
                when code_coding_{{i}}_system ilike '%rxnorm%' then 'http://www.nlm.nih.gov/research/umls/rxnorm'
                when code_coding_{{i}}_system ilike '%ndc%' then 'http://hl7.org/fhir/sid/ndc'
                else code_coding_{{i}}_system 
            end as system
        ,   code_coding_{{i}}_display as display
    from {{ref(stage_table)}}
    where  code_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
