-- TODO Eng-1029 -- TOTALLY UNSED
{% macro get_medication_dispense_category_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id as medication_dispense_id
        ,   category_coding_{{i}}_code as code
        ,   case 
                when category_coding_{{i}}_system like '%medicationdispense-category' then 'http://terminology.hl7.org/fhir/CodeSystem/medicationdispense-category'
            end as system
        ,   category_coding_{{i}}_display as display
    from {{ref(stage_table)}}
    where  category_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
-- TODO Eng-1029 -- TOTALLY UNSED
{% macro get_medication_dispense_type_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id as medication_dispense_id
        ,   type_coding_{{i}}_code as code
        ,   case 
                when type_coding_{{i}}_system like '%v3-ActCode%' then 'http://terminology.hl7.org/CodeSystem/v3-ActCode'
                else type_coding_{{i}}_system 
            end as system
        ,   type_coding_{{i}}_display as display
    from {{ref(stage_table)}}
    where  type_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
