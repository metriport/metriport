-- TODO Eng-1029 -- TOTALLY UNSED
{% macro get_medication_administration_category_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id as medication_administration_id
        ,   category_coding_{{i}}_code as code
        ,   case 
                when category_coding_{{i}}_system like '%medication-admin-category' then 'http://terminology.hl7.org/CodeSystem/medication-admin-category'
                else category_coding_{{i}}_system 
            end as system
        ,   category_coding_{{i}}_display as display
    from {{ref(stage_table)}}
    where  category_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
-- TODO Eng-1029 -- TOTALLY UNSED
{% macro get_medication_administration_reason_codings(stage_table, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select
            id as medication_administration_id
        ,   reasoncode_{{i}}_coding_{{j}}_code as code
        ,   case 
                when reasoncode_{{i}}_coding_{{j}}_system like '%reason-medication-given' then 'http://terminology.hl7.org/CodeSystem/reason-medication-given'
                else reasoncode_{{i}}_coding_{{j}}_system 
            end as system
        ,   reasoncode_{{i}}_coding_{{j}}_display as display
    from {{ref(stage_table)}}
    where  reasoncode_{{i}}_coding_{{j}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
