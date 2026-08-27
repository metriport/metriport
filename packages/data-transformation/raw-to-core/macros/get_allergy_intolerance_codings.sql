{% macro get_allergy_intolerance_codings(systems, max_index) %}
    {#- Optimized: Single table scan with CTE -#}
    with base_allergy as (
        select 
            id
            {% for i in range(max_index + 1) %},
            code_coding_{{i}}_code,
            code_coding_{{i}}_system,
            code_coding_{{i}}_display
            {% endfor %}
        from {{ref('stage__allergyintolerance')}}
    )
    {% for i in range(max_index + 1) %}
    select 
        id as allergy_intolerance_id,
        code_coding_{{i}}_code as code,
        case 
            when code_coding_{{i}}_system ilike '%snomed%' then 'http://snomed.info/sct'
            else code_coding_{{i}}_system 
        end as system,
        code_coding_{{i}}_display as display,
        {{i}} as coding_index
    from base_allergy
    where code_coding_{{i}}_code != '' 
        and code_coding_{{i}}_code is not null
        and case 
            when code_coding_{{i}}_system ilike '%snomed%' then 'http://snomed.info/sct'
            else code_coding_{{i}}_system 
        end in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro get_allergy_intolerance_clinical_status_codings(systems, max_index) %}
    {#- Optimized: Single table scan with CTE -#}
    with base_allergy as (
        select 
            id
            {% for i in range(max_index + 1) %},
            clinicalstatus_coding_{{i}}_code,
            clinicalstatus_coding_{{i}}_system,
            clinicalstatus_coding_{{i}}_display
            {% endfor %}
        from {{ref('stage__allergyintolerance')}}
    )
    {% for i in range(max_index + 1) %}
    select 
        id as allergy_intolerance_id,
        clinicalstatus_coding_{{i}}_code as code,
        case 
            when clinicalstatus_coding_{{i}}_system ilike '%allergyintolerance-clinical%' then 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical'
            else clinicalstatus_coding_{{i}}_system 
        end as system,
        clinicalstatus_coding_{{i}}_display as display,
        {{i}} as coding_index
    from base_allergy
    where clinicalstatus_coding_{{i}}_code != '' 
        and clinicalstatus_coding_{{i}}_code is not null
        and case 
            when clinicalstatus_coding_{{i}}_system ilike '%allergyintolerance-clinical%' then 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical'
            else clinicalstatus_coding_{{i}}_system 
        end in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
