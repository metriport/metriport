{% macro observation_code_system() %}
    case 
        when system = 'loinc' then 0
        when system = 'snomed-ct' then 1
        when system = 'cpt' then 2
        when system = 'actcode' then  3
        else 4
    end
{% endmacro %}

{% macro get_observtaion_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id as observation_id
        ,   code_coding_{{i}}_code as code
        ,   case 
                when code_coding_{{i}}_system ilike '%loinc%' then 'loinc'
                when code_coding_{{i}}_system ilike '%snomed%' then 'snomed-ct'
                when code_coding_{{i}}_system ilike '%cpt%' then 'cpt'
                when code_coding_{{i}}_system ilike '%actcode%' then 'actcode'
                else code_coding_{{i}}_system 
            end as system
        ,   code_coding_{{i}}_display as display
        ,   coalesce(
                code_coding_{{i}}_display,
                code_text
            ) as description
    from {{ref(stage_table)}}
    where  code_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro observation_category_code_system() %}
    case 
        when system = 'observation-category' then 0
        else 1
    end
{% endmacro %}

{% macro get_observation_category_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id as observation_id
        ,   category_{{i}}_coding_0_code as code
        ,   case 
                when category_{{i}}_coding_0_system = 'http://terminology.hl7.org/CodeSystem/observation-category' then 'observation-category'
                else category_{{i}}_coding_0_system 
            end as system
        ,   category_{{i}}_coding_0_display as display
        ,   coalesce(
                category_{{i}}_coding_0_display,
                category_{{i}}_text
            ) as description
    from {{ref(stage_table)}}
    where  category_{{i}}_coding_0_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro observation_interpretation_code_system() %}
    case 
        when system = 'observation-interpretation' then 0
        when system = 'snomed-ct' then 1
        else 2
    end
{% endmacro %}

{% macro get_observation_interpretation_codings(stage_table, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select
            id as observation_id
        ,   interpretation_{{i}}_coding_{{j}}_code as code
        ,   case 
                when interpretation_{{i}}_coding_{{j}}_system = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation' then 'observation-interpretation'
                when interpretation_{{i}}_coding_{{j}}_system ilike '%snomed%' then 'snomed-ct'
                else interpretation_{{i}}_coding_{{j}}_system 
            end as system
        ,   interpretation_{{i}}_coding_{{j}}_display as display
        ,   coalesce(
                interpretation_{{i}}_coding_{{j}}_display,
                interpretation_{{i}}_text
            ) as description
    from {{ref(stage_table)}}
    where  interpretation_{{i}}_coding_{{j}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}