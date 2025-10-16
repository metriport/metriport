{% macro get_observtaion_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id as observation_id
        ,   code_coding_{{i}}_code as code
        ,   case 
                when code_coding_{{i}}_system ilike '%loinc%' then 'http://loinc.org'
                when code_coding_{{i}}_system ilike '%snomed%' then 'http://snomed.info/sct'
                else code_coding_{{i}}_system 
            end as system
        ,   code_coding_{{i}}_display as display
    from {{ref(stage_table)}}
    where  code_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro get_observation_category_codings(stage_table, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select
            id as observation_id
        ,   category_{{i}}_coding_{{j}}_code as code
        ,   case 
                when category_{{i}}_coding_{{j}}_system = '%observation-category' then 'http://terminology.hl7.org/CodeSystem/observation-category'
                else category_{{i}}_coding_{{j}}_system 
            end as system
        ,   category_{{i}}_coding_{{j}}_display as display
    from {{ref(stage_table)}}
    where  category_{{i}}_coding_{{j}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro get_observation_interpretation_codings(stage_table, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select
            id as observation_id
        ,   interpretation_{{i}}_coding_{{j}}_code as code
        ,   case 
                when interpretation_{{i}}_coding_{{j}}_system = '%ObservationInterpretation' then 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation'
                else interpretation_{{i}}_coding_{{j}}_system 
            end as system
        ,   interpretation_{{i}}_coding_{{j}}_display as display
    from {{ref(stage_table)}}
    where  interpretation_{{i}}_coding_{{j}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro get_observation_bodysite_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id as observation_id
        ,   bodysite_coding_{{i}}_code as code
        ,   case 
                when bodysite_coding_{{i}}_system ilike '%snomed%' then 'http://snomed.info/sct'
                else bodysite_coding_{{i}}_system 
            end as system
        ,   bodysite_coding_{{i}}_display as display
    from {{ref(stage_table)}}
    where  bodysite_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
