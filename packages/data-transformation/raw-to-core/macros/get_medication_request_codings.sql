{% macro medication_request_category_code_system() %}
    case 
        when system = 'medication-category' then 0
        when system = 'snomed-ct' then 1
        else 2
    end
{% endmacro %}

{% macro get_medication_request_category_codings(stage_table, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select
            id as medication_request_id
        ,   category_{{i}}_coding_{{j}}_code as code
        ,   case 
                when category_{{i}}_coding_{{j}}_system = 'http://terminology.hl7.org/CodeSystem/medication-category' then 'medication-category'
                when category_{{i}}_coding_{{j}}_system ilike '%snomed%' then 'snomed-ct'
                else category_{{i}}_coding_{{j}}_system 
            end as system
        ,   category_{{i}}_coding_{{j}}_display as display
        ,   coalesce(
                category_{{i}}_coding_{{j}}_display,
                category_{{i}}_text
            ) as description
    from {{ref(stage_table)}}
    where  category_{{i}}_coding_{{j}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}