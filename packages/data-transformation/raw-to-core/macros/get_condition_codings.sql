{% macro get_condition_codings(systems, max_index) %}
    {% for i in range(max_index + 1) %}
    select *
    from (
        select 
                id as condition_id
            ,   code_coding_{{i}}_code as code
            ,   case 
                    when code_coding_{{i}}_system ilike '%icd-10%' then 'http://hl7.org/fhir/sid/icd-10-cm'
                    when code_coding_{{i}}_system ilike '%snomed%' then 'http://snomed.info/sct'
                    when code_coding_{{i}}_system ilike '%icd-9%' then 'http://hl7.org/fhir/sid/icd-9-cm'
                    else code_coding_{{i}}_system 
                end as system
            ,   code_coding_{{i}}_display as display
            ,   {{i}} as index
        from {{ref('stage__condition')}}
        where code_coding_{{i}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro get_condition_category_codings(systems, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select *
    from (
        select 
                id as condition_id
            ,   category_{{i}}_coding_{{j}}_code as code
            ,   case 
                    when category_{{i}}_coding_{{j}}_system ilike '%condition-category' then 'http://terminology.hl7.org/CodeSystem/condition-category'
                    else category_{{i}}_coding_{{j}}_system 
                end as system
            ,   category_{{i}}_coding_{{j}}_display as display
            ,   {{i}} * ({{ secondary_max_index }} + 1) + {{j}} as index
        from {{ref('stage__condition')}}
        where category_{{i}}_coding_{{j}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro get_condition_clinical_status_codings(systems, max_index) %}
    {% for i in range(max_index + 1) %}
    select *
    from (
        select 
                id as condition_id
            ,   clinicalstatus_coding_{{i}}_code as code
            ,   case 
                    when clinicalstatus_coding_{{i}}_system ilike '%condition-clinical' then 'http://terminology.hl7.org/CodeSystem/condition-clinical'
                    else clinicalstatus_coding_{{i}}_system 
                end as system
            ,   clinicalstatus_coding_{{i}}_display as display
            ,   {{i}} as index
        from {{ref('stage__condition')}}
        where  clinicalstatus_coding_{{i}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
